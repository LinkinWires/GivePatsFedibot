import { pat } from "./shared";

export abstract class FediDriver {
    public idFilename: string;
    public constructor(idFilename = '.last-id') {
        this.idFilename = idFilename;
    }
    abstract Tick(): Promise<void>;
    protected abstract _getMe(): Promise<object>;
    protected abstract _getMentions(sinceId?: string, untilId?: string): Promise<object[]>;
    protected abstract _saveLastMentionIdToFile(id?: string): Promise<void>;
    protected abstract _uploadMedia(file: Blob, alt?: string): Promise<object>
    protected abstract _post(text: string, mentions: string[], visibility: string, replyId: string, mediaId?: string): Promise<object>;
    protected async _loadLastMentionIdFromFile(): Promise<string | undefined> {
        const file = Bun.file(this.idFilename);
        if (await file.exists()) {
            const id = await file.text();
            return id;
        } else throw Error('Last ID file does not exist.');
    }
    protected async _avatarToGif(avatarUrl: string, filename: string): Promise<Buffer> {
        const avatar = await fetch(avatarUrl);
        await Bun.write(filename, avatarUrl);
        return await pat(filename);
    }
}