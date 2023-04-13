/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { data } from 'cheerio/lib/api/attributes';
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
    cdr = 0;
    skeletonDuration = 0;
    MindOverMatter = "No";
    pathfinder = "No";
    flaskMastery = "No";
    staffDefenseMastery = "No";
    flaskIncEffect = "No";
    swapWandCount = 0;
    loopRings = "Two";
    loopRingsCount = 2;

    skeletonDamage = 0;
    frDamage = 0;
    totalLoopDamage = 0;
    frWard = "No/Bad";
    bodyLoopSpeed = "Fail";

    playerClass  = "";

    fixArray : string[] = [];

    constructor(message : Message) {
        this.message = message; 
    }
    
    setGemData(gem : any, gemData : any, slot: string) {
        if(!(slot === "Weapon 2 Swap" || slot ==="Weapon 1 Swap")) {
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

        await this.initlaizeGems(data);

        if(data.toString().match(/28589/gm)!=null) {
            this.staffDefenseMastery = "Yes";
        } else {
            this.fixArray.push('- You are missing 30% Increased Global defenses Staff Mastery');
        }

        if(this.playerStats['Ward'] > 2000) {
            let multiplier = 2;
            if(this.staffDefenseMastery === "Yes") {multiplier = 2.3;}
            this.playerStats['Ward'] = (parseInt(this.playerStats['Ward'])  + 200 * multiplier) * 0.3;
            this.playerStats['Ward'] = Math.floor(this.playerStats['Ward']);
            // TODO -- Handle flask suffix increased ward, handle incrased effect of flasks
        }

        const ringCount = data.toString().match(/Heartbound Loop/gm);

        if(ringCount?.length == 1) {
            this.loopRings = "One";
            this.loopRingsCount = 1;
        } else {
            this.loopRingsCount = 2;
        }

        this.initLoopDamage();

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
            if(this.skeletonDuration > 0.250) {
                this.fixArray.push('- Check To Dusts or Minion Speed Quality');
            }
        }

        if(finalReduced < 0.165) {
            this.skeletonDuration = finalReduced;
            this.fixArray.push('- Check To Dusts and Reduced duration on tree');
        }

        // Physical hits as elemental damage
        const physAsEle = data.toString().match(/\d+[%] of Physical Damage from Hits taken as (Cold|Fire|Lightning) Damage$/gm);

        if(physAsEle != null) {
            this.physAsEle = "Yes"
            this.fixArray.push("- Remove Helm Implicit Phys as ele damage taken mod")
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
        
        if(this.manaRecoup == 0) {
            this.fixArray.push('- You are missing Mana Recoup on tree/items')
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

        if(this.lifeRecoup == 0) {
            this.fixArray.push('- You are missing Life Recoup on tree/items')
        }

        const cdrList = data.toString().match(/\d+% increased Cooldown Recovery Rate$/gm)
        if(cdrList!=null) {

            for(const cdrMod of cdrList) {
                this.cdr = this.cdr + parseInt(cdrMod.substring(0, cdrMod.indexOf('%')));
            }
        }
    
        if(data.toString().match(/34098/gm)!=null) {
            this.MindOverMatter = "Yes";
        }

        if(data.toString().match(/8281/gm)!=null) {
            const lightOne = data.toString().match(/Adds \d+ to \d+ Lightning Damage( to Spells)?/gm);
            const lightTwo = data.toString().match(/\d+ to \d+ Added Spell Lightning Damage (while holding a Shield|while wielding a Two Handed Weapon)/gm);
            if(lightOne == null && lightTwo == null) {
                this.fixArray.push('- Missing Lightning Damage to spells for Elementalist Ascendancy');
            }
        }

        if(data.toString().match(/9327/gm)!=null) {
            this.pathfinder = "Yes";
        }

        if(data.toString().match(/Pathfinder/gm)!=null) {
            this.pathfinder = "Yes";
        }

        if(this.pathfinder === "No" && this.playerClass === "Scion") {
            this.fixArray.push("- Missing Pathfinder Ascendancy");
        }

        // if(data.toString().match(/59906/gm)!=null) {
        //     this.flaskMastery = "Yes";
        // } else {
        //     this.fixArray.push('- You are missing Utility flask mastery, check and compare your tree');
        // }
              
        const flaskIncEffect = data.toString().match(/Flasks applied to you have \d+% increased Effect/gm);
        if(flaskIncEffect!=null) {
            this.flaskIncEffect = "Yes"
            this.fixArray.push('- Remove Increased Effect Of Flasks from items/tree, this reduces your Ward');
        }

        const wandCheck = data.toString().match(/Spectral Spirits when Equipped/gm);
        if(wandCheck != null) {
            this.swapWandCount = wandCheck.length;
        } else {
            this.fixArray.push('- You are missing Swap Wands, craft them using Essence of Insanity');
        }

        if(this.playerStats['Armour'] !== '0') {
            this.fixArray.push('- Your Armor is not 0, this must be 0');
        }

        if(this.minionSpeed.quality < 20) {
            this.fixArray.push('- Minion Speed is not 20% quality');
        }

        if(this.cdr < 9) {
            this.fixArray.push('- You are missing 9% cdr, craft on belt or boots');
            if(![34, 59].includes(this.totalDust) ) {
                this.fixArray.push('- For 9%-26% CDR, To Dust Total Reduced Skeleton Duration must be 34 + Window Of Opporutnity Notable or 59 Without Window Of Opportunity Notable. And Dont use Less Duration Mastery or Less Duration Gem.');
            }
        }

        if(this.cdr > 9 && this.cdr <27 ) {
            if(![34, 59].includes(this.totalDust) ) {
                this.fixArray.push('- For 9%-26% CDR, To Dust Total Reduced Skeleton Duration must be 34 + Window Of Opporutnity Notable or 59 Without Window Of Opportunity Notable. And Dont use Less Duration Mastery or Less Duration Gem.');
            }
        }

        if(this.cdr >= 27) {
            if(![34, 58].includes(this.totalDust) ) {
                this.fixArray.push('- Your To Dust total must be total 34 with less duration mastery on tree or 58 and less duration gem without less duration on tree');
            }

            if(this.totalDust == 34 ) {
                if(this.lessDurationMastery ===  "No") {
                    this.fixArray.push('- You need to allocate Less Duration Mastery on tree or use Less duration gem for 27% CDR');
                }
            }
        }

        if(this.cdr < 27 && this.lessDurationMastery ===  "Yes") {
            this.fixArray.push("- Your CDR is less than 27%, remove less duration mastery");
        }

        const isBalbala = data.toString().match(/Balbala/gm);

        if(isBalbala==null) {
            this.fixArray.push('- Your Timeless Jewel is not Balbala')
        }

        return Promise.resolve();
    }

    initLoopDamage() {
        // Math time now

        // const ringList = data.toString().match(/\d+ Physical Damage taken on Minion Death/);
        
        let skeletonCount = 2;

        const skeletonLevel = parseInt(this.skeletonGem.level);

        if(skeletonLevel > 10) {
            skeletonCount = 3;
        }

        if(skeletonLevel >19 ) {
            skeletonCount = 4;
        }
        
        this.skeletonDamage = 420 * this.loopRingsCount * skeletonCount;

        this.frDamage = Math.floor((parseInt(this.playerStats['Life']) * 0.4  
                        + parseInt(this.playerStats['EnergyShield']) * 0.25) 
                        * (1 - parseInt(this.playerStats['ChaosResist'])/100));
        
        this.totalLoopDamage = this.skeletonDamage + this.frDamage;

        let gemPlus = 0;

        const loyal = data.toString().match(/Skin of the Loyal/gm);
        if(loyal!=null) gemPlus = 1;

        const lords = data.toString().match(/Skin of the Lords/gm);
        if(loyal!=null) gemPlus = 2;

        const gLevel = parseInt(this.bodyCWDT.level) + gemPlus - 1;
        const cwdtArray = [ 528, 583, 661, 725, 812, 897, 1003, 1107, 1221, 1354, 1485, 1635, 1804, 1980, 2184, 2394, 2621, 2874, 3142, 3272, 3580, 3950, 4350 ];
        let threshold;

        if(gLevel <24) {
            threshold= cwdtArray[gLevel];
        } else {
            threshold = 9999;
        }

        if(this.bodyCWDT.qualityId === "Divergent") {
            threshold = threshold * (1 - this.bodyCWDT.quality/100);
        }

        if(this.totalLoopDamage >= threshold) {
            this.bodyLoopSpeed = "Full Speed";
        } else {
            this.fixArray.push('- Your Loop is either half speed or fails, please use calculator to check https://returnx.github.io/cwdt/')
        }

        if(!Number.isInteger(this.playerStats['Ward'])) {
            this.playerStats['Ward'] = parseInt(this.playerStats['Ward']);
        }

        if(this.playerStats['Ward'] >= this.frDamage ) {
            this.frWard = "Yes/Good";
        } else {
            this.fixArray.push('- Ward is less than FR damage, adjust Life and Chaos Res or remove Mind Over Matter, see https://returnx.github.io/cwdt/')
        }
    }

    async initlaizeGems(data : Buffer) {
        const jsonData = await xml2js.parseStringPromise(data);

        this.playerClass = jsonData.PathOfBuilding.Build[0].$.className;

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
    }

}