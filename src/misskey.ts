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
    public constructor(instanceUrl: string, accessToken: string, mode: 'gif' | 'emoji' = 'gif', debug = false, idFilename = '.last-id') {
        super(debug, idFilename);
        this.mode = mode;
        this._api = new misskeyApi.APIClient({
            origin: instanceUrl,
            credential: accessToken,
        });
        this._saveLastMentionIdToFile();
    }
    private _composeFqn(user: User): string {
        return `@${user.username}${user.host ? `@${user.host}` : ''}`;
    }
    private async _getMe(): Promise<User> {
        return await this._api.request('i', {});
    }
    private async _getUsers(ids: string[]): Promise<User[]> {
        return await this._api.request('users/show', {userIds: ids});
    }
    protected async _getMentions(sinceId?: string, untilId?: string, markAsRead: boolean = true): Promise<Notification[]> {
        return await this._api.request('i/notifications', {sinceId: sinceId, untilId: untilId, markAsRead: markAsRead, includeTypes: ['mention']});
    }
    protected async _uploadMedia(file: Blob, alt?: string): Promise<DriveFile> {
        return await this._api.request('drive/files/create', {file: file, comment: alt});
    }
    protected async _post(mediaId: string, text: string, mentions: string[], visibility: 'public' | 'home' | 'followers' | 'specified', replyId: string): Promise<NotesCreateResponse> {
        const postRequest = {
            visibility: visibility,
            visibleUserIds: visibility === 'specified' ? mentions : undefined,
            replyId: replyId,
            text: text,
            mediaIds: [mediaId],
        }
        return await this._api.request('notes/create', postRequest);
    }
    protected async _saveLastMentionIdToFile(id?: string): Promise<void> {
        if (id) {
            await Bun.write(this.idFilename, id);
        } else {
            const lastMention = (await this._getMentions())[0];
            if (!lastMention) {
                if (this.debug) throw Error('GetMentions() returned empty array.');
                else {
                    console.error('GetMentions() returned empty array.');
                    return;
                }
            }
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
            if (mention.type !== 'mention') {
                if (this.debug) throw Error('Notification type is not a mention');
                else {
                    console.error('Notification type is not a mention');
                    return;
                }
            }

            if (mention.userId === self.id) {
                if (this.debug) throw Error('Post was created by the bot itself');
                else {
                    console.error('Post was created by the bot itself');
                    return;
                }
            }

            if (mention.note.reply && mention.note.reply.userId === self.id) {
                if (this.debug) throw Error("This post is a reply to the bot's post");
                else {
                    console.error("This post is a reply to the bot's post");
                    return;
                }
            }

            const noteMentions = mention.note.mentions;
            if (!noteMentions) {
                if (this.debug) throw Error('Note has no mentions');
                else {
                    console.error('Note has no mentions');
                    return;
                }
            }

            if (noteMentions.length === 1 && noteMentions[0] === self.id) {
                // If mention is a reply to other note
                if (mention.note.replyId) {
                    const replyOp = mention.note.user;
                    const originalNote = mention.note.reply!;
                    const op = originalNote.user;
                    const opAvatarUrl = op.avatarUrl;
                    if (!opAvatarUrl) {
                        if (this.debug) throw Error('This user has no profile picture');
                        else {
                            console.error('This user has no profile picture');
                            return;
                        }
                    }
                    const opAvatar = await fetch(opAvatarUrl);
                    const opAvatarFilename = `tmp/${op.id}.webp`;
                    await Bun.write(opAvatarFilename, opAvatar);
                    const opAvatarPat = await pat(opAvatarFilename);
                    const opAvatarPatUpload = await this._uploadMedia(new Blob([opAvatarPat]), `${this._composeFqn(op)} getting patted =3`);
                    if (this.mode === 'gif') this._post(opAvatarPatUpload.id, `${this._composeFqn(op)} ${this._composeFqn(replyOp)}`, [op.id, replyOp.id], mention.note.visibility, mention.note.id);
                } else {
                    const op = mention.note.user;
                    const opAvatarUrl = op.avatarUrl;
                    if (!opAvatarUrl) {
                        if (this.debug) throw Error('This user has no profile picture');
                        else {
                            console.error('This user has no profile picture');
                            return;
                        }
                    }
                    const opAvatar = await fetch(opAvatarUrl);
                    const opAvatarFilename = `tmp/${op.id}.webp`;
                    await Bun.write(opAvatarFilename, opAvatar);
                    const opAvatarPat = await pat(opAvatarFilename);
                    const opAvatarPatUpload = await this._uploadMedia(new Blob([opAvatarPat]), `${this._composeFqn(op)} getting patted =3`);
                    if (this.mode === 'gif') this._post(opAvatarPatUpload.id, `${this._composeFqn(op)}`, [op.id], mention.note.visibility, mention.note.id);
                    
                }
            } else {
                const op = mention.note.user;
                const otherMentionsIds = noteMentions.filter(mentionedUser => mentionedUser !== self.id);
                const otherMentions = await this._getUsers(otherMentionsIds);
                otherMentions.forEach(async mentionedUser => {
                    const userAvatarUrl = mentionedUser.avatarUrl;
                    if (!userAvatarUrl) {
                        if (this.debug) throw Error('This user has no profile picture');
                        else {
                            console.error('This user has no profile picture');
                            return;
                        }
                    }
                    const userAvatar = await fetch(userAvatarUrl);
                    const userAvatarFilename = `tmp/${mentionedUser.id}.webp`;
                    await Bun.write(userAvatarFilename, userAvatar);
                    const userAvatarPat = await pat(userAvatarFilename);
                    const userAvatarPatUpload = await this._uploadMedia(new Blob([userAvatarPat]), `${this._composeFqn(mentionedUser)} getting patted =3`);
                    if (this.mode === 'gif') this._post(userAvatarPatUpload.id, `${this._composeFqn(op)} ${this._composeFqn(mentionedUser)}`, [op.id, mentionedUser.id], mention.note.visibility, mention.note.id);
                })
            }
            this._saveLastMentionIdToFile(mention.id);
        });
    }
}