import petPetGif from "@someaspy/pet-pet-gif";
import { $ } from "bun";

export function getMime(file: string | Buffer): string {
    if (typeof file === 'string') {
        const bunFile = Bun.file(file);
        if (!bunFile.exists()) throw Error('This file does not exist');
        else return bunFile.type;
    } else {
        const blob = new Blob([file]);
        return blob.type;
    }
}

export async function pat(filename: string): Promise<Buffer> {
    const mime = getMime(filename);
    const format = mime.replace('image/', '');
    let finalFilename = '';
    if (mime !== 'image/png') {
        const newFilename = `${filename.replace(format, 'png')}`;
        await $`ffmpeg -loglevel error -hide_banner -y -i ${filename} ${newFilename}`;
        finalFilename = newFilename;
        await Bun.file(filename).delete();
    } else finalFilename = filename;
    const gif = await petPetGif(finalFilename, { resolution: 512, delay: 20, backgroundColor: null });
    if (finalFilename !== filename) await Bun.file(finalFilename).delete();
    return gif;
}