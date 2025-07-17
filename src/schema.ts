export abstract class FediDriver {
    public debug: boolean;
    public idFilename: string;
    public constructor(debug = false, idFilename = '.last-id') {
        this.debug = debug;
        this.idFilename = idFilename;
    }
    abstract Tick(): Promise<void>;
    abstract GetMentions(sinceId?: string, untilId?: string): Promise<object[]>;
    abstract SaveLastMentionIdToFile(id: string): Promise<void>;
    abstract UploadMedia(file: Blob, alt?: string): Promise<object>
    abstract Post(mediaId: string, text: string, mentions: string[], visibility: string, replyId: string): Promise<object>;
    public async LoadLastMentionIdFromFile(): Promise<string | undefined> {
        const file = Bun.file(this.idFilename);
        if (await file.exists()) {
            const id = await file.text();
            return id;
        } else {
            if (this.debug) throw Error('Last ID file does not exist.');
            else {
                console.error('Last ID file does not exist.');
                return undefined;
            }
        }
    }
}