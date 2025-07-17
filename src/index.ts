import { createRestAPIClient, createStreamingAPIClient } from 'masto';
import petPetGif from '@someaspy/pet-pet-gif';
import { CronJob } from 'cron';
import { $ } from 'bun';
import { MisskeyDriver } from './misskey';

if (!process.env.INSTANCE_URL) throw Error('No instance URL provided');
if (!process.env.ACCESS_TOKEN) throw Error('No access token provided');
if (!process.env.SOFTWARE) throw Error('No software provided');

const instance = process.env.SOFTWARE === 'misskey' ? new MisskeyDriver(process.env.INSTANCE_URL, process.env.ACCESS_TOKEN) : null;
if (!instance) throw Error('Unsupported software')

const job = new CronJob(
    '*/5 * * * * *',
    async function () {
        await instance.Tick();
    },
    null,
    true,
    'UTC',
);

/*
const masto = createRestAPIClient({
    url: process.env.INSTANCE_URL,
    accessToken: process.env.ACCESS_TOKEN,
});

let latestId: string | null = null;

async function processNotifications() {
    const notifications = await masto.v1.notifications.fetch({
        types: ['mention'],
        sinceId: latestId,
    });

    notifications.forEach(async (notification) => {
        if (!notification.status) throw Error('For some reason notification with mention does not have the post the bot was mentioned in.');

        // For some reason `account.fqn` is not a part of the interface defenition, but at runtime this property does exist.
        // @ts-expect-error
        const statusCreator = `@${notification.status.account.fqn}`;
        if (notification.status.visibility === 'direct') {
            await masto.v1.statuses.create({
                status: `${statusCreator} Sorry! I do not support DMs.`,
                inReplyToId: notification.status.id,
            })
        }
        const mentions = notification.status.mentions.filter(mention => mention.username !== process.env.BOT_USERNAME);
        const accounts = await Promise.all(mentions.map(async mention => await masto.v1.accounts.lookup({acct: mention.username})));

        accounts.forEach(async account => {
            // For some reason `account.fqn` is not a part of the interface defenition, but at runtime this property does exist.
            // @ts-expect-error
            const mentionedPerson = `@${account.fqn}`

            const avatar = await fetch(account.avatarStatic);
            const path = `tmp/${account.id}.tmp`;
            const pngPath = `tmp/${account.id}.png`
            await Bun.write(path, avatar);
            await $`ffmpeg -y -i ${path} ${pngPath}`;
            const animatedAvatar = await petPetGif(`tmp/${account.id}.png`);

            const attachment = await masto.v2.media.create({
                file: new Blob([animatedAvatar]),
                description: ``,
            });
            await masto.v1.statuses.create({
                status: `${statusCreator} ${mentionedPerson}`,
                visibility: notification.status.visibility,
                mediaIds: [attachment.id],
                inReplyToId: notification.status.id,
            });

            Bun.file(path).delete();
            Bun.file(pngPath).delete();
        })

        latestId = notification.id;
    });
}
*/