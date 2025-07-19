import { createRestAPIClient } from "masto";
import { FediDriver } from "./schema";
import type { Notification } from "masto/mastodon/entities/v1/notification.js";
import type { MediaAttachment } from "masto/mastodon/entities/v1/media-attachment.js";
import type { Account } from "masto/mastodon/entities/v1/account.js";
import { pat } from "./shared";

export class MastodonDriver extends FediDriver {
    private _api;
    public botUsername: string;
    public constructor(instanceUrl: string, accessToken: string, botUsername: string, idFilename = '.last-id') {
        super(idFilename);
        this.botUsername = botUsername;
        this._api = createRestAPIClient({
            url: instanceUrl,
            accessToken: accessToken,
        });
        this._saveLastMentionIdToFile();
    }
    // custom methods
    private async _getUser(id: string): Promise<Account>
    private async _getUser(id: string[]): Promise<Account[]>
    private async _getUser(id: string | string[]): Promise<Account | Account[]> {
        const response = await this._api.v1.accounts.fetch({
            id: typeof id === 'string' ? [id] : id,
        });
        if (typeof id === 'string') return response[0]!;
        else return response;
    }
    // abstract implementations
    protected async _getMe(): Promise<Account> {
        return await this._api.v1.accounts.lookup({
            acct: this.botUsername,
        });
    }
    protected async _getMentions(sinceId?: string, untilId?: string): Promise<Notification[]> {
        return await this._api.v1.notifications.fetch({
            types: ['mention'],
            sinceId: sinceId,
            maxId: untilId,
        });
    }
    protected async _saveLastMentionIdToFile(id?: string): Promise<void> {
        if (id) await Bun.write(this.idFilename, id);
        else {
            const lastMention = (await this._getMentions())[0];
            if (!lastMention) throw Error('GetMentions() returned empty array.');
            await Bun.write(this.idFilename, lastMention.id);
        }
    }
    protected async _uploadMedia(file: Blob, alt?: string): Promise<MediaAttachment> {
        return await this._api.v2.media.create({
            file: file,
            description: alt,
        })
    }
    // fun fact: this working bad with sharkey if visibility is private btw was the inspiration for various drivers
    protected async _post(mediaId: string, text: string, mentions: string[], visibility: 'direct' | 'public' | 'private' | 'unlisted', replyId: string): Promise<object> {
        return await this._api.v1.statuses.create({
            status: `${mentions.reduce((pv, cv) => pv += `@${cv} `, '').trim()} ${text}`,
            visibility: visibility,
            mediaIds: [mediaId],
            inReplyToId: replyId,
        })
    }
    public async Tick(): Promise<void> {
        const self = await this._getMe();
        const lastId = await this._loadLastMentionIdFromFile();
        const unreadMentions = await this._getMentions(lastId);
        if (unreadMentions.length > 0) {
            console.log(`new mentions: ${unreadMentions.map(mention => mention.id)}`);
        }
        unreadMentions.forEach(async mention => {
            if (mention.type !== 'mention') throw Error('Notification type is not a mention');
            if (mention.status.account.id === self.id) throw Error('Status was created by the bot itself');
            if (mention.status.inReplyToAccountId === self.id) throw Error("This post is a reply to the bot's post");
            
            const statusMentions = mention.status.mentions;
            if (statusMentions.length < 1) throw Error('Status has no mentions');

            // if the only mentioned account in the post is the bot
            if (statusMentions.length === 1 && statusMentions[0]!.id === self.id) {
                // creating pat pat gif of the person in the reply
                if (mention.status.inReplyToAccountId) {
                    const replyOp = mention.account;
                    const op = await this._getUser(mention.status.inReplyToAccountId);
                    const opAvatarUrl = op.avatarStatic;
                    const opAvatar = await fetch(opAvatarUrl);
                    const opAvatarFilename = `tmp/${op.id}.${/\.\w+$/.exec(opAvatarUrl)![0]}`;
                    await Bun.write(opAvatarFilename, opAvatar);
                    const opAvatarPat = await pat(opAvatarFilename);
                    const opAvatarPatUpload = await this._uploadMedia(new Blob([opAvatarPat]), `@${op.acct} getting patted =3`);
                    this._post(opAvatarPatUpload.id, '', [replyOp.acct, op.acct], mention.status.visibility, mention.status.id);
                // creating pat pat gif of the person who tagged this bot
                // before you blame them for being too prideful, maybe they just have a bad day =(
                } else {
                    const op = mention.account;
                    const opAvatarUrl = op.avatarStatic;
                    const opAvatar = await fetch(opAvatarUrl);
                    const opAvatarFilename = `tmp/${op.id}.${/\.\w+$/.exec(opAvatarUrl)![0]}`;
                    await Bun.write(opAvatarFilename, opAvatar);
                    const opAvatarPat = await pat(opAvatarFilename);
                    const opAvatarPatUpload = await this._uploadMedia(new Blob([opAvatarPat]), `@${op.acct} getting patted =3`);
                    this._post(opAvatarPatUpload.id, '', [op.acct], mention.status.visibility, mention.status.id)
                }
            // creating pat pat gif of everyone mentioned except the bot
            } else {
                const op = mention.account;
                const otherMentions = statusMentions.filter(mention => mention.id !== self.id);
                otherMentions.forEach(async mentionedUser => {
                    const mentionedUserInstance = await this._getUser(mentionedUser.id);
                    const userAvatarUrl = mentionedUserInstance.avatarStatic;
                    const userAvatar = await fetch(userAvatarUrl);
                    const userAvatarFilename = `tmp/${op.id}.${/\.\w+$/.exec(userAvatarUrl)![0]}`;
                    await Bun.write(userAvatarFilename, userAvatar);
                    const userAvatarPat = await pat(userAvatarFilename);
                    const userAvatarPatUpload = await this._uploadMedia(new Blob([userAvatarPat]), `@${mentionedUser.acct} getting patted =3`);
                    this._post(userAvatarPatUpload.id, '', [op.acct, mentionedUser.acct], mention.status.visibility, mention.status.id);
                })
            }
            this._saveLastMentionIdToFile(mention.id);
        })
    }
}