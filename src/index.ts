import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import { MessageHandler } from './MessageHandler';
import path from 'node:path'

dotenv.config({ path: path.join('src', 'resources', 'config.env') });

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const messageHandler = new MessageHandler(client);

client.once(Events.ClientReady, () => {
	console.log('Ready!');
});

client.on(Events.MessageCreate, async ( message :  Message) => {
    messageHandler.handleMessage(message);
})

client.login(process.env.TOKEN);
