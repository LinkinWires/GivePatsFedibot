import { FediDriver } from "./schema";

export class MastodonDriver extends FediDriver {
    private _api;
    protected async _getMentions(sinceId?: string, untilId?: string): Promise<object[]> {
        
    }
    protected async _saveLastMentionIdToFile(id: string): Promise<void> {
        
    }
    protected async _uploadMedia(file: Blob, alt?: string): Promise<object> {
        
    }
    protected async _loadLastMentionIdFromFile(): Promise<string | undefined> {
        
    }
    protected async _post(mediaId: string, text: string, mentions: string[], visibility: string, replyId: string): Promise<object> {
        
    }
    public async Tick(): Promise<void> {
        
    }
}