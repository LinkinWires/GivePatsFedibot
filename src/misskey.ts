/*
So uh, I think I should write this in the beginning of the file.
The reason I'm not streaming mentions but doing the whole fuckery I'm doing is that Bun crashes when you try to initialize Misskey stream client.
Might be related to this, error is exactly the same: https://github.com/oven-sh/bun/issues/17005 
*/

import { api as misskeyApi } from 'misskey-js';
import { FediDriver } from './schema';
import type { DriveFile, NotesCreateResponse, Notification, User } from 'misskey-js/entities.js';
import type { APIClient } from 'misskey-js/api.js';
import { pat } from './shared';

export class MisskeyDriver extends FediDriver {
    private _api: APIClient;
    public mode: 'gif' | 'emoji';
    public constructor(instanceUrl: string, accessToken: string, mode: 'gif' | 'emoji' = 'gif', idFilename = '.last-id') {
        super(idFilename);
        this.mode = mode;
        this._api = new misskeyApi.APIClient({
            origin: instanceUrl,
            credential: accessToken,
        });
        this._saveLastMentionIdToFile();
    }
    // custom methods
    private _composeFqn(user: User): string {
        return `@${user.username}${user.host ? `@${user.host}` : ''}`;
    }
    private _composeEmojiName(user: User): string {
        return `${user.username}${user.host ? `-${user.host.replaceAll('.', '-')}` : ''}-patpat`
    }
    private async _getUsers(ids: string[]): Promise<User[]> {
        return await this._api.request('users/show', {userIds: ids});
    }
    private async _addCustomEmoji(mediaId: string, name: string, category: string) {
        const emoteList = await this._api.request('admin/emoji/list', {query: name});
        if (emoteList[0]) return await this._api.request('admin/emoji/update', {name: name, fileId: mediaId});
        else return await this._api.request('admin/emoji/add', {name: name, fileId: mediaId, category: category});
    }
    // abstract implementations
    protected async _getMe(): Promise<User> {
        return await this._api.request('i', {});
    }
    protected async _getMentions(sinceId?: string, untilId?: string, markAsRead: boolean = true): Promise<Notification[]> {
        return await this._api.request('i/notifications', {sinceId: sinceId, untilId: untilId, markAsRead: markAsRead, includeTypes: ['mention']});
    }
    protected async _uploadMedia(file: Blob, filename: string, alt?: string): Promise<DriveFile> {
        return await this._api.request('drive/files/create', {file: file, name: filename, comment: alt});
    }
    protected async _post(text: string, mentions: string[], visibility: 'public' | 'home' | 'followers' | 'specified', replyId: string, mediaId?: string): Promise<NotesCreateResponse> {
        const postRequest = {
            visibility: visibility,
            visibleUserIds: visibility === 'specified' ? mentions : undefined,
            replyId: replyId,
            text: text,
            mediaIds: mediaId ? [mediaId] : undefined,
        }
        return await this._api.request('notes/create', postRequest);
    }
    protected async _saveLastMentionIdToFile(id?: string): Promise<void> {
        if (id) await Bun.write(this.idFilename, id);
        else {
            const lastMention = (await this._getMentions())[0];
            if (!lastMention) throw Error('GetMentions() returned empty array.');
            await Bun.write(this.idFilename, lastMention.id);
        }
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
            if (mention.userId === self.id) throw Error('Note was created by the bot itself');
            if (mention.note.reply && mention.note.reply.userId === self.id) throw Error("This note is a reply to the bot's note");

            const noteMentions = mention.note.mentions;
            if (!noteMentions || noteMentions.length < 1) throw Error('Note has no mentions');

            // if the only mentioned account in the post is the bot
            if (noteMentions.length === 1 && noteMentions[0] === self.id) {
                // creating pat pat gif of the person in the reply
                if (mention.note.replyId) {
                    const replyOp = mention.user; // user who tagged the bot
                    const originalNote = mention.note.reply!;
                    const op = originalNote.user; // user who the tagger responded to
                    const opAvatarUrl = op.avatarUrl;
                    if (!opAvatarUrl) throw Error('This user has no profile picture');
                    const opAvatarFilename = `tmp/${op.id}.webp`;
                    const opAvatarPat = await this._avatarToGif(opAvatarUrl, opAvatarFilename);
                    const opAvatarPatUpload = await this._uploadMedia(new Blob([opAvatarPat]),`${op.id}.gif`,  `${this._composeFqn(op)} getting patted =3`);
                    if (this.mode === 'gif') this._post(`${this._composeFqn(op)} ${this._composeFqn(replyOp)}`, [op.id, replyOp.id], mention.note.visibility, mention.note.id, opAvatarPatUpload.id);
                    else {
                        const emojiName = this._composeEmojiName(op);
                        await this._addCustomEmoji(opAvatarPatUpload.id, emojiName, 'patpat');
                        this._post(`${this._composeFqn(op)} ${this._composeFqn(replyOp)} :${emojiName}:`, [op.id, replyOp.id], mention.note.visibility, mention.note.id);
                    }
                // creating pat pat gif of the person who tagged this bot
                // before you blame them for being too prideful, maybe they just have a bad day =(
                } else {
                    const op = mention.note.user;
                    const opAvatarUrl = op.avatarUrl;
                    if (!opAvatarUrl) throw Error('This user has no profile picture');
                    const opAvatarFilename = `tmp/${op.id}.webp`;
                    const opAvatarPat = await this._avatarToGif(opAvatarUrl, opAvatarFilename);
                    const opAvatarPatUpload = await this._uploadMedia(new Blob([opAvatarPat]), `${op.id}.gif`, `${this._composeFqn(op)} getting patted =3`);
                    if (this.mode === 'gif') this._post(`${this._composeFqn(op)}`, [op.id], mention.note.visibility, mention.note.id, opAvatarPatUpload.id);
                    else {
                        const emojiName = this._composeEmojiName(op);
                        await this._addCustomEmoji(opAvatarPatUpload.id, emojiName, 'patpat');
                        this._post(`${this._composeFqn(op)} :${emojiName}:`, [op.id], mention.note.visibility, mention.note.id);
                    }
                }
            // creating pat pat gif of everyone mentioned except the bot
            } else {
                const op = mention.note.user;
                const otherMentionsIds = noteMentions.filter(mentionedUser => mentionedUser !== self.id);
                const otherMentions = await this._getUsers(otherMentionsIds);
                otherMentions.forEach(async mentionedUser => {
                    const userAvatarUrl = mentionedUser.avatarUrl;
                    if (!userAvatarUrl) throw Error('This user has no profile picture');
                    const userAvatarFilename = `tmp/${mentionedUser.id}.webp`;
                    const userAvatarPat = await this._avatarToGif(userAvatarUrl, userAvatarFilename);
                    const userAvatarPatUpload = await this._uploadMedia(new Blob([userAvatarPat]), `${mentionedUser.id}.gif`, `${this._composeFqn(mentionedUser)} getting patted =3`);
                    if (this.mode === 'gif') this._post(`${this._composeFqn(op)} ${this._composeFqn(mentionedUser)}`, [op.id, mentionedUser.id], mention.note.visibility, mention.note.id, userAvatarPatUpload.id);
                    else {
                        const emojiName = this._composeEmojiName(mentionedUser);
                        await this._addCustomEmoji(userAvatarPatUpload.id, emojiName, 'patpat');
                        this._post(`${this._composeFqn(op)} ${this._composeFqn(mentionedUser)} :${emojiName}:`, [op.id, mentionedUser.id], mention.note.visibility, mention.note.id);
                    }
                })
            }
            this._saveLastMentionIdToFile(mention.id);
        });
    }
}