/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Message } from 'discord.js';
import * as zlib from 'node:zlib'
import xml2js from 'xml2js';

export class PlayerData { 
    readonly message : Message;

    // Player stats
    playerStats : any = [];

    // Gems
    skeletonGem : any = {};
    minionSpeed : any = {};
    forbiddenRite : any = {};
    weaponCWDT : any = {};
    bodyCWDT : any = {};
    skeletonCWDT : any = {};
    frCWDT : any = {};
    
    // Item info
    physAsEle = "No";
    totalDust = 0;
    lessDurationMastery = "No";
    lifeRecoup = 0;
    manaRecoup = 0;
    cdr = "0%";
    skeletonDuration = 0;
    MindOverMatter = "No";
    pathfinder = "No";
    flaskMastery = "No";
    staffDefenseMastery = "No";
    flaskIncEffect = "No";
    swapWandCount = 0;
    loopRings = "Two";
    loopRingsCount = 2;

    constructor(message : Message) {
        this.message = message; 
    }
    
    setGemData(gem : any, gemData : any, slot: string) {
        gem.level = gemData.level;
        if(gemData.qualityId === 'Alternate1') {
            gem.qualityId = 'Anomalous';
        } else if (gemData.qualityId === 'Alternate2') {
            gem.qualityId = 'Divergent';  
        } else if (gemData.qualityId === 'Alternate3') {
            gem.qualityId = 'Phantasmal';
        } else {
            gem.qualityId = 'Normal';
        }
        gem.quality = gemData.quality;
        gem.slot = slot;
    }

    async initlizeData() {

        const url : RegExpMatchArray | null = this.message.content.match(/\bhttps?:\/\/\S+/gi);

        if(url?.[0].includes('pastebin')) {
            url![0] = url![0].replace('pastebin.com','pobb.in')
        }
       
        const pobHTML = await axios.get(url![0]);
        const $ = cheerio.load(pobHTML.data);
        const buffer = Buffer.from($('textarea').text(), 'base64');
        const data = zlib.inflateSync(buffer);

        const jsonData = await xml2js.parseStringPromise(data)

        // Prepare stats
        for(let i  =0; i < jsonData.PathOfBuilding.Build[0].PlayerStat.length ; i++) {
            const stat = jsonData.PathOfBuilding.Build[0].PlayerStat[i].$.stat;
            const value =  jsonData.PathOfBuilding.Build[0].PlayerStat[i].$.value;
            
            this.playerStats[stat] = value;
        }
    
        // console.log

        for(let i = 0; i < jsonData.PathOfBuilding.Skills[0].SkillSet[0].Skill.length; i++ ) {
            const slot = jsonData.PathOfBuilding.Skills[0].SkillSet[0].Skill[i];
            if(slot.Gem!=undefined) {
                for(let i = 0; i <slot.Gem.length; i++) {
                    if(slot.Gem[i].$.nameSpec === 'Summon Skeletons') {
                        this.setGemData(this.skeletonGem, slot.Gem[i].$, slot.$.slot );
    
                        for(let j = 0; j < slot.Gem.length; j++) {
                            if(slot.Gem[j].$.nameSpec === 'Cast when Damage Taken') {
                                this.setGemData(this.skeletonCWDT, slot.Gem[j].$, slot.$.slot );
                            }
                        }
                    }
                    if(slot.Gem[i].$.nameSpec === 'Minion Speed') {
                        this.setGemData(this.minionSpeed, slot.Gem[i].$, slot.$.slot );
                    }
                    if(slot.Gem[i].$.nameSpec === "Forbidden Rite") {
                        this.setGemData(this.forbiddenRite, slot.Gem[i].$, slot.$.slot );
                        for(let j = 0; j < slot.Gem.length; j++) {
                            if(slot.Gem[j].$.nameSpec === 'Cast when Damage Taken') {
                                this.setGemData(this.frCWDT, slot.Gem[j].$, slot.$.slot );
                            }
                        }
                    }
                    if(slot.Gem[i].$.nameSpec === "Cast when Damage Taken") {
                        if(slot.$.slot === "Weapon 1") {
                            this.setGemData(this.weaponCWDT, slot.Gem[i].$, slot.$.slot );
                        }
                        if(slot.$.slot === "Body Armour") {
                            this.setGemData(this.bodyCWDT, slot.Gem[i].$, slot.$.slot );
                        }
                    }
                }
            }
        }

        // Skeleton Duration
        const toDustArray = data.toString().match(/\d\d[%] reduced Skeleton Duration/gm);

        for(const item of toDustArray!) {
            this.totalDust = this.totalDust + parseInt( item.substring(0, 2) );
        }

        if(data.toString().match(/21730/gm)!=null) {
            this.lessDurationMastery = "Yes";
        }

        // Skeleton Duration
        let reducedDuration = 0;
        if(data.toString().match(/52099/gm)!=null) {
            reducedDuration = reducedDuration + 5;
        }
        if(data.toString().match(/14090/gm)!=null) {
            reducedDuration = reducedDuration + 5;
        }
        if(data.toString().match(/4207/gm)!=null) {
            reducedDuration = reducedDuration + 15;
        }

        const reduction = (this.totalDust + reducedDuration + this.minionSpeed.quality*2)/100;

        let finalReduced = 20 * (1 - reduction);

        if(this.lessDurationMastery == "Yes") {
            finalReduced = finalReduced * 0.9;
        }

        if(finalReduced<=0.198) {
            this.skeletonDuration = 0.198;
        }

        if(finalReduced > 0.198) {
            this.skeletonDuration = 0.231;
        }

        if(finalReduced > 0.231) {
            this.skeletonDuration = finalReduced;
        }

        // Physical hits as elemental damage
        const physAsEle = data.toString().match(/\d+[%] of Physical Damage from Hits taken as (Cold|Fire|Lightning) Damage/gm);

        if(physAsEle != null) {
            this.physAsEle = "Yes"
        }

        // Mana recoup
        const battleRouse = data.toString().match(/5289/gm);
        if(battleRouse!=null) {

            this.manaRecoup = this.manaRecoup + 10;

            const manaMastery = data.toString().match(/59064/gm);
            if(manaMastery!=null) {
                this.manaRecoup = this.manaRecoup + 10;
            }
        }

        const itemRecoup = data.toString().match(/\d[%] of Damage taken Recouped as Mana/gm);

        if(itemRecoup!=null) {
            for(const item of itemRecoup!) {
                this.manaRecoup = this.manaRecoup + parseInt( item.substring(0, 1));
            }
        }
               
        // Life Recoup
        if(data.toString().match(/37403/gm)!=null) {
            this.lifeRecoup = this.lifeRecoup + 18;
        }
        if(data.toString().match(/2474/gm)!=null) {
            this.lifeRecoup = this.lifeRecoup + 6;
        }
        if(data.toString().match(/55804/gm)!=null) {
            this.lifeRecoup = this.lifeRecoup + 6;
        }

        const implicitRecoup = data.toString().match(/\d+[%] of Physical Damage taken Recouped as Life/gm);
        if(implicitRecoup!=null) {
            for(const item of implicitRecoup!) {
                this.lifeRecoup = this.lifeRecoup + parseInt( item.substring(0, 2));
            }
        }

        const itemLifeRecoup = data.toString().match(/\d+[%] of Damage taken Recouped as Life/gm)
        if(itemLifeRecoup!=null) {
            for(const item of itemLifeRecoup!) {
                this.lifeRecoup = this.lifeRecoup + parseInt( item.substring(0, 2));
            }
            
        }        

        if(this.playerStats['Cooldown'] === '0.198') {
            this.cdr = "27%";
        } else if(this.playerStats['Cooldown'] === '0.231') {
            this.cdr = "9%";
        }

   
        if(data.toString().match(/34098/gm)!=null) {
            this.MindOverMatter = "Yes";
        }

        if(data.toString().match(/9327/gm)!=null) {
            this.pathfinder = "Yes";
        }

        if(data.toString().match(/Pathfinder/gm)!=null) {
            this.pathfinder = "Yes";
        }

        if(data.toString().match(/59906/gm)!=null) {
            this.flaskMastery = "Yes";
        }
        
        if(data.toString().match(/28589/gm)!=null) {
            this.staffDefenseMastery = "Yes";
        }
        
        if(this.playerStats['Ward'] > 2000) {
            let multiplier = 2;
            if(this.staffDefenseMastery === "Yes") {multiplier = 2.3;}
            this.playerStats['Ward'] = (parseInt(this.playerStats['Ward'])  + 200 * multiplier) * 0.3;
            // TODO -- Handle flask suffix increased ward, handle incrased effect of flasks
        }

        const flaskIncEffect = data.toString().match(/Flasks applied to you have \d+% increased Effect/gm);
        if(flaskIncEffect!=null) {
            this.flaskIncEffect = "Yes"
        }

        const wandCheck = data.toString().match(/Spectral Spirits when Equipped/gm);
        if(wandCheck != null) {
            this.swapWandCount = wandCheck.length;
        }

        const ringCount = data.toString().match(/Heartbound Loop/gm);
        if(ringCount?.length == 1) {
            this.loopRings = "One";
            this.loopRingsCount = 1;
        }


        // Math time now
        let skeletonCount = 2;
        
        if(this.skeletonGem.level === "11") {
            skeletonCount = 3;
        }
        if(this.skeletonGem.level === "20" || this.skeletonGem.level ==="21" ) {
            skeletonCount = 4;
        }

        const skeletonDamage = 420 * this.loopRingsCount * skeletonCount;

        let frDamage = 0;
       
        frDamage = parseInt(this.playerStats['Life']) * 0.4  + parseInt(this.playerStats['EnergyShield']) * 0.25;
        frDamage = frDamage * (1 - parseInt(this.playerStats['ChaosResist'])/100);

        return Promise.resolve();
    }

}