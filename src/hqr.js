
export const loadHQR = (buffer, size, isScene = true) => {
    const entries = [];
    const offsets = [];
    const header = new DataView(buffer);

     // skip correct HQR format num entries bytes missing for scenes
    let offset = isScene ? 0 : 4;
    let numEntries = 0;

    while (true) {
        const dataOffset = header.getUint32(offset, true);
        if (dataOffset === size) {
            break;
        }
        offset += 4;
        numEntries++;
        offsets.push(dataOffset);
    }

    for (let i = 0; i < numEntries; i += 1) {
        const entry = new DataView(buffer, offsets[i], 10);
        const e = {
            offset: offsets[i] + 10,
            originalSize: entry.getUint32(0, true),
            compressedSize: entry.getUint32(4, true),
            type: entry.getInt16(8, true),
        };
        entries.push(e);
    }

    return entries;
};

export const decompressHQR = (buffer, entry) => {
    let src_pos = 0;
    let tgt_pos = 0;
    const tgt_buffer = new ArrayBuffer(entry.originalSize);
    const source = new Uint8Array(buffer, entry.offset, entry.compressedSize);
    const target = new Uint8Array(tgt_buffer);
    
    while ((src_pos + 1) <= entry.compressedSize) {
        const flag = source[src_pos];

        for (let i = 0; i < 8; i += 1) {
            src_pos += 1;

            if ((flag & (1 << i)) !== 0) {
                target[tgt_pos] = source[src_pos];
                tgt_pos += 1;
            } else {
                const e = (source[src_pos] * 256) + source[src_pos + 1];
                const len = ((e >> 8) & 0x000F) + entry.type + 1;
                const addr = ((e << 4) & 0x0FF0) + ((e >> 12) & 0x00FF);

                for (let g = 0; g < len; g += 1) {
                    target[tgt_pos] = target[tgt_pos - addr - 1];
                    tgt_pos += 1;
                }
                src_pos += 1;
            }

            if ((src_pos + 1) >= entry.compressedSize)
                break;
        }

        src_pos += 1;
    }
    return tgt_buffer;    
};
