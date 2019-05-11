import fs from 'fs';
import path from 'path';
import os from 'os';

import { loadHQR, decompressHQR } from './hqr';

const datapath = path.join(__dirname,'../data');
const dumppath = path.join(__dirname,'../dump');

const RESOURCES = [
    { isScene: false, name: 'CREDITS.HQR' },
    { isScene: false, name: 'RESSOURC.HQR' },
    { isScene: true, name: 'SCENE.HQR', totalScenes: 11 }, // stage 8 only has 1 run
];

const dumpHQR = (group, filepath, name) => {
    const fc = fs.readFileSync(path.join(datapath, filepath, name));
    const buffer = fc.buffer.slice(fc.byteOffset, fc.byteOffset + fc.byteLength);

    const entries = loadHQR(buffer, fc.byteLength);

    for (let e = 0; e < entries.length; e++) { 
        const entry = entries[e];
        const data = decompressHQR(buffer, entry);
        const dumppathentry = path.join(dumppath, group, filepath);
        if (!fs.existsSync(dumppathentry)){
            fs.mkdirSync(dumppathentry, { recursive: true });
        }
        fs.writeFileSync(path.join(dumppathentry, `${name}_${e}.raw`), Buffer.from(data));
    }
}

for (let r = 0; r < RESOURCES.length; r += 1) {
    const res = RESOURCES[r];

    if (res.isScene) {
        for (let s = 0; s < res.totalScenes; s += 1) {
            const stage = `STAGE0${s.toString(16)}`;
            dumpHQR('SCENES', path.join(stage, 'RUN0'), res.name);
            if (s === 8) {
                break; // skip second run
            }
            dumpHQR('SCENES', path.join(stage, 'RUN1'), res.name);
        }
    } else {
        dumpHQR(res.name.split('.')[0], '', res.name);
    }
}

console.log('Dump Complete!!');

process.exit(0);
