import { CronJob } from 'cron';
import { MisskeyDriver } from './misskey';
import { MastodonDriver } from './mastodon';

if (!process.env.INSTANCE_URL) throw Error('No instance URL provided');
if (!process.env.ACCESS_TOKEN) throw Error('No access token provided');
if (!process.env.SOFTWARE) throw Error('No software provided');

let instance = null;
switch (process.env.SOFTWARE) {
    case 'misskey':
        instance = new MisskeyDriver(
            process.env.INSTANCE_URL, 
            process.env.ACCESS_TOKEN, 
            process.env.MISSKEY_MODE && process.env.MISSKEY_MODE === 'gif' || process.env.MISSKEY_MODE === 'emoji' ? process.env.MISSKEY_MODE : 'gif'
        );
        break;
    case 'mastodon':
        if (!process.env.BOT_USERNAME) throw Error('Mastodon driver required BOT_USERNAME env variable defined (example: bot, without the @ and the instance domain name)')
        instance = new MastodonDriver(
            process.env.INSTANCE_URL, 
            process.env.ACCESS_TOKEN, 
            process.env.BOT_USERNAME
        );
        break;
}
if (!instance) throw Error('Unsupported software')

const job = new CronJob(
    '*/5 * * * * *',
    async function () {
        try {
            await instance.Tick();
        } catch (e) {
            if (process.env.DEBUG) throw e;
            else console.error(e);
        }
    },
    null,
    true,
    'UTC',
);