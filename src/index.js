import fs from 'fs';
import path from 'path';
import os from 'os';
import bmp from 'bmp-js';

import { loadHQR, decompressHQR, loadBIG } from './hqr';

const datapath = path.join(__dirname,'../data');
const dumppath = path.join(__dirname,'../dump');

const RESOURCES = [
    { isScene: false, name: 'CREDITS.HQR' },
    { isScene: false, name: 'RESSOURC.HQR' },
    { isScene: true, name: 'SCENE.HQR', totalScenes: 11 }, // stage 8 only has 1 run
];

const BIG_FILES = [4, 9, 10, 11, 14];
const BIG_FILES_STAGE8 = [4, 11, 14];
const BIG_FILES_RESSOURC = [0, 1, 2, 26, 28, 31, 32, 33, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, /*103,*/ 104, 105, 106, 107, 108, 109, 110, 111, 112, 113];

let lastPaletteData = null;

const isWaveform = (data) => {
    const view = new DataView(data);
    if (view.byteLength >= 4) {
        const riff = view.getInt32(0, true);
        if (riff === 1179011410) { // RIFF found
            return true;
        }
    }
    return false;
};

const getFileExtension = (data) => {
    if (data.byteLength === 768) {
        return 'pal';
    } else if ( // not the best but to avoid creating a metadata file
        data.byteLength === 19200 // texture 160x120
        || data.byteLength === 65025 // texture 255x255
        || data.byteLength === 65536 // shading palette image 
        || data.byteLength === 76800 // image 320x240
        || data.byteLength === 153600 // image 320x480
        || data.byteLength === 307200 // image 640x480
    ) {
        return 'lim';
    } else if (isWaveform(data)) {
        return 'wav';
    }
    return 'raw';
};

const getImageSize = (data) => {
    switch(data.byteLength) {
        case 19200: // texture 160x120
            return { w: 160, h: 120 };
        case 65025: // texture 255x255
            return { w: 255, h: 255 };
        case 65536: // shading palette image 
            return { w: 256, h: 256 };
        case 76800: // image 320x240
            return { w: 320, h: 240 };
        case 153600: // image 320x480
            return { w: 320, h: 480 };
        case 307200: // image 640x480
            return { w: 640, h: 480 };
    }
    return { w: 0, h: 0 };
};

const convertBuffer = (index, ext, data, filepath, filename) => {
    if (ext === 'pal') {
        lastPaletteData = new DataView(data);
    } else if (ext === 'lim') { 
        const view = new DataView(data);
        const { w, h } = getImageSize(data);

        const image = new Uint8Array(w * h * 4);
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                const rawOffset = (y * w + x);
                const palOffset = view.getUint8(rawOffset, true);
        
                const r = lastPaletteData.getUint8(palOffset * 3, true);
                const g = lastPaletteData.getUint8(palOffset * 3 + 1, true);
                const b = lastPaletteData.getUint8(palOffset * 3 + 2, true);

                const offset = rawOffset * 4;
                image[offset    ] = 255; // alpha
                image[offset + 1] = b;
                image[offset + 2] = g;
                image[offset + 3] = r;
            }
        }
        const bmpData = {
            data: image,
            width: w,
            height: h,
        };
        const rawData = bmp.encode(bmpData);
        fs.writeFileSync(path.join(filepath, `${filename}.bmp`), rawData.data);
    }
};

const dumpHQR = (group, filepath, name, stage) => {
    const fc = fs.readFileSync(path.join(datapath, filepath, name));
    const buffer = fc.buffer.slice(fc.byteOffset, fc.byteOffset + fc.byteLength);

    const entries = loadHQR(buffer, fc.byteLength);

    for (let e = 0; e < entries.length; e += 1) { 
        const entry = entries[e];
        const data = decompressHQR(buffer, entry);
        const dumppathentry = path.join(dumppath, group, filepath);
        if (!fs.existsSync(dumppathentry)){
            fs.mkdirSync(dumppathentry, { recursive: true });
        }
        const ext = getFileExtension(data);
        fs.writeFileSync(path.join(dumppathentry, `${name}_${e}.${ext}`), Buffer.from(data));
        convertBuffer(e, ext, data, dumppathentry, `${name}_${e}`);

        if (stage !== 8 && BIG_FILES.includes(e) ||
            stage === 8 && BIG_FILES_STAGE8.includes(e)) {
            const bigEntries = loadBIG(data, entry.originalSize);
            for (let b = 0; b < bigEntries.length; b += 1) {
                const bigEntry = bigEntries[b];
                const dumppathentrybig = path.join(dumppathentry, `${name}_${e}_BIG`);
                if (!fs.existsSync(dumppathentrybig)){
                    fs.mkdirSync(dumppathentrybig, { recursive: true });
                }
                const ext = getFileExtension(bigEntry.data);
                fs.writeFileSync(path.join(dumppathentrybig, `${name}_${e}_BIG_${b}.${ext}`), Buffer.from(bigEntry.data));
                convertBuffer(b, ext, bigEntry.data, dumppathentrybig, `${name}_${e}_BIG_${b}`);
            }
        }

        if (stage === 'RESSOURC' && BIG_FILES_RESSOURC.includes(e)) {
            const bigEntries = loadBIG(data, entry.originalSize, true);
            for (let b = 0; b < bigEntries.length; b += 1) {
                const bigEntry = bigEntries[b];
                const dumppathentrybig = path.join(dumppathentry, `${name}_${e}_BIG`);
                if (!fs.existsSync(dumppathentrybig)){
                    fs.mkdirSync(dumppathentrybig, { recursive: true });
                }
                const ext = getFileExtension(bigEntry.data);
                fs.writeFileSync(path.join(dumppathentrybig, `${name}_${e}_BIG_${b}.${ext}`), Buffer.from(bigEntry.data));
                convertBuffer(b, ext, bigEntry.data, dumppathentrybig, `${name}_${e}_BIG_${b}`);
            }
        }
    }
}

for (let r = 0; r < RESOURCES.length; r += 1) {
    const res = RESOURCES[r];

    if (res.isScene) {
        for (let s = 0; s < res.totalScenes; s += 1) {
            const stage = `STAGE0${s.toString(16).toUpperCase()}`;
            dumpHQR('SCENES', path.join(stage, 'RUN0'), res.name, s);
            if (s === 8 || s === 10) {
                continue; // skip second run
            }
            dumpHQR('SCENES', path.join(stage, 'RUN1'), res.name, s);
        }
    } else {
        const nameNoExt = res.name.split('.')[0];
        dumpHQR(nameNoExt, '', res.name, nameNoExt);
    }
}

console.log('Dump Complete!!');

process.exit(0);
