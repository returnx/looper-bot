import { Client, Message, Channel, TextChannel } from 'discord.js';
import { PlayerData } from './PlayerData';

export class MessageHandler {

    readonly client : Client;

    constructor(client : Client) {
        this.client = client;
    }

    async handleMessage(message: Message) {
        if (message.author.bot) return;

        if(message.content.startsWith("check") || message.channelId === "988474586490368110") {
            if(message.content.includes("pastebin.com") || message.content.includes("pobb.in")) {
                await this.handlePoB(message);
            }
        }
        if (message.content.startsWith("help mana") || message.content.startsWith("help multiple swaps"))
            await this.sendMessage(message, "Testing messages");
    }

    async sendMessage(message: Message, helpStr: string) {
        const channel : Channel | null = await this.client.channels.fetch(message.channelId);
        (channel as TextChannel).send(helpStr);
        return Promise.resolve();
    }

    async handlePoB(message: Message) {

        const playerData  = new PlayerData(message);
        try {
            await playerData.initlizeData();
        }
        catch(err) {
            console.log("This has failed " + message.content);
            this.sendMessage(message, "Something has failed here, check for 404 or Check PoB Manually!");
            return Promise.resolve(false);
        }

        const messageString = 

            `\`\`\`----------------------PoB Check----------------------
[Life: ${playerData.playerStats['Life']}]   [EnergyShield: ${playerData.playerStats['EnergyShield']}]   [Ward: ${playerData.playerStats['Ward']}]   [Mana: ${playerData.playerStats['Mana']}]   [ChaosResist: ${playerData.playerStats['ChaosResist']}]   [Armour: ${playerData.playerStats['Armour']}]

Loop Status - ${playerData.bodyLoopSpeed}

FR Damage - ${playerData.frDamage}
Ward More Than FR Damage - ${playerData.frWard}

Cooldown - ${playerData.cdr}%
Skeleton Duration - ${playerData.skeletonDuration}
To Dusts - ${playerData.totalDust}
Less Duration Mastery - ${playerData.lessDurationMastery}

Loop Rings - ${playerData.loopRings}

MindOverMatter - ${playerData.MindOverMatter}
Pathfinder - ${playerData.pathfinder}
Flask Mastery - ${playerData.flaskMastery}
Staff Defense Mastery - ${playerData.staffDefenseMastery}

[Life Recoup - ${playerData.lifeRecoup}] [Mana Recoup - ${playerData.manaRecoup}]

Swap Weapons - ${playerData.swapWandCount}
[Flasks Increased Effect - ${playerData.flaskIncEffect}] [Physical Hits As Ele Damage - ${playerData.physAsEle}]

[Summon Skeletons  - ${playerData.skeletonGem.qualityId} ${playerData.skeletonGem.level}/${playerData.skeletonGem.quality}]  [Minion Speed     - ${playerData.minionSpeed.qualityId} ${playerData.minionSpeed.level}/${playerData.minionSpeed.quality}] [Skeleton CWDT    - ${playerData.skeletonCWDT.qualityId} ${playerData.skeletonCWDT.level}/${playerData.skeletonCWDT.quality}]
[Forbidden Rite    - ${playerData.forbiddenRite.qualityId} ${playerData.forbiddenRite.level}/${playerData.forbiddenRite.quality}]       [FR CWDT          - ${playerData.frCWDT.qualityId} ${playerData.frCWDT.level}/${playerData.frCWDT.quality}]
[Body CWDT         - ${playerData.bodyCWDT.qualityId} ${playerData.bodyCWDT.level}/${playerData.bodyCWDT.quality}]  [Weapon CWDT      - ${playerData.weaponCWDT.qualityId} ${playerData.weaponCWDT.level}/${playerData.weaponCWDT.quality}]
\`\`\``;
        this.sendMessage(message, messageString);
        
    }
}