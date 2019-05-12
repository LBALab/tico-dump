import fs from 'fs';
import path from 'path';
import os from 'os';

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
        fs.writeFileSync(path.join(dumppathentry, `${name}_${e}.raw`), Buffer.from(data));

        if (stage !== 8 && BIG_FILES.includes(e) ||
            stage === 8 && BIG_FILES_STAGE8.includes(e)) {
            const bigEntries = loadBIG(data, entry.originalSize);
            for (let b = 0; b < bigEntries.length; b += 1) {
                const bigEntry = bigEntries[b];
                const dumppathentrybig = path.join(dumppathentry, `${name}_${e}_BIG`);
                if (!fs.existsSync(dumppathentrybig)){
                    fs.mkdirSync(dumppathentrybig, { recursive: true });
                }
                const ext = (e === 4) ? 'wav' : 'raw';
                fs.writeFileSync(path.join(dumppathentrybig, `${name}_${e}_BIG_${b}.${ext}`), Buffer.from(bigEntry.data));
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
        dumpHQR(res.name.split('.')[0], '', res.name, -1);
    }
}

console.log('Dump Complete!!');

process.exit(0);
