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
    lessDuration : any = {};

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
    totalWard = 0;

    crucibleWeaponReducedDuration = false;

    playerClass  = "";

    treeData : any;
    pobString : any;

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

        this.pobString = data.toString();
        this.treeData = this.pobString.match(/<Spec.*>/gm);
        this.treeData = this.treeData[0];

        if(this.bodyCWDT === undefined) {
            this.fixArray.push("- CWDT Gem in body is missing, the bot cannot check");
        }

        if(this.treeData.match(/28589/gm)!=null) {
            this.staffDefenseMastery = "Yes";
        } else {
            this.fixArray.push('- You are missing 30% Increased Global defenses Staff Mastery');
        }

        // handling ward ---------------------------------------------------------
        const wardArray = data.toString().match(/Ward: \d\d\d/gm);

        for(const item of wardArray!) {
            this.totalWard = this.totalWard + parseInt( item.substring(6, 9) );
        }

        let skin = false;
        const loyal = data.toString().match(/Skin of the/gm);
        if(loyal!=null) skin = true;

 
        let multiplier = 1;
        if(skin) multiplier = multiplier + 1;
        if(this.staffDefenseMastery === "Yes") {multiplier = multiplier + 0.3;}

        const flaskMultiArray = data.toString().match(/\d\d% increased Ward during Effect/gm);
        let flaskMulti = 0;

        if(flaskMultiArray!=null) {
            for(const item of flaskMultiArray!) {
                flaskMulti  = flaskMulti + parseInt(item.substring(0,2))/100;
            }
        }
        multiplier = flaskMulti + multiplier;

        this.playerStats['Ward'] = (this.totalWard + 200) * multiplier * 0.3;

        // TODO -- Handle flask suffix increased ward, handle incrased effect of flasks
        // ------------------------------------------------------------------------

        const ringCount = data.toString().match(/Heartbound Loop/gm);

        if(ringCount?.length == 1) {
            this.loopRings = "One";
            this.loopRingsCount = 1;
        } else {
            this.loopRingsCount = 2;
        }

        const skeletonDamageArray = data.toString().match(/\d\d\d Physical Damage taken on Minion Death/gm);

        for(const item of skeletonDamageArray!) {
            this.skeletonDamage = this.skeletonDamage + parseInt( item.substring(0, 3) );
        }

        this.initLoopDamage(data.toString());

        // Skeleton Duration
        const toDustArray = data.toString().match(/\d\d[%] reduced Skeleton Duration/gm);

        for(const item of toDustArray!) {
            this.totalDust = this.totalDust + parseInt( item.substring(0, 2) );
        }

        if(this.treeData.match(/21730/gm)!=null) {
            this.lessDurationMastery = "Yes";
        }

        // Skeleton Duration
        let reducedDuration = 0;
        if(this.treeData.match(/52099/gm)!=null) {
            reducedDuration = reducedDuration + 5;
        }
        if(this.treeData.match(/14090/gm)!=null) {
            reducedDuration = reducedDuration + 5;
        }
        if(this.treeData.match(/4207/gm)!=null) {
            reducedDuration = reducedDuration + 15;
        }

        if(this.pobString.match(/{crucible}10% reduced Skill Effect Duration/)!=null) {
            this.crucibleWeaponReducedDuration = true;
            reducedDuration = reducedDuration + 10;
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
                this.fixArray.push('- Check To Dusts, Minion Speed Quality, reduced/increased duration of skills on tree and items');
            }
        }

        if(finalReduced > 0.165 &&  finalReduced < 0.198) {
            this.skeletonDuration = 0.165;
        }

        if(finalReduced < 0.165) {
            this.skeletonDuration = finalReduced;
            this.fixArray.push('- Check To Dusts and Reduced/Increaed duration of skills on tree and items');
        }

        // Physical hits as elemental damage
        const physAsEle = data.toString().match(/\d+[%] of Physical Damage from Hits taken as (Cold|Fire|Lightning) Damage$/gm);

        if(physAsEle != null) {
            this.physAsEle = "Yes"
            this.fixArray.push("- Remove Helm Implicit Phys as ele damage taken mod")
        }

        // Mana recoup
        const battleRouse = this.treeData.match(/5289/gm);
        if(battleRouse!=null) {
            this.manaRecoup = this.manaRecoup + 10;
        }

        const manaMastery = this.treeData.match(/59064/gm);
        if(manaMastery!=null) {
            this.manaRecoup = this.manaRecoup + 10;
        }

        const itemRecoup = this.pobString.match(/\d[%] of Damage taken Recouped as Mana/gm);

        if(itemRecoup!=null) {
            for(const item of itemRecoup!) {
                this.manaRecoup = this.manaRecoup + parseInt( item.substring(0, 1));
            }
        }
        
        if(this.manaRecoup === 0) {
            this.fixArray.push('- You are missing Mana Recoup on tree/items')
        }

        // Life Recoup
        if(this.treeData.match(/37403/gm)!=null) {
            this.lifeRecoup = this.lifeRecoup + 18;
        }
        if(this.treeData.match(/2474/gm)!=null) {
            this.lifeRecoup = this.lifeRecoup + 6;
        }
        if(this.treeData.match(/55804/gm)!=null) {
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

        const cryCDR = this.pobString.match(/Cry has \d+% increased Cooldown Recovery Rate/gm); 
        if(cryCDR!=null) {
            this.fixArray.push("Please remove Warcry boot implicit and try again");
        }
    
        if(this.treeData.match(/34098/gm)!=null) {
            this.MindOverMatter = "Yes";
        }

        if(this.treeData.match(/9327/gm)!=null) {
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
            this.fixArray.push('- Remove Increased Effect Of Flasks from items or tree. this reduces your Ward');
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

        if(this.minionSpeed.qualityId != "Anomalous") {
            this.fixArray.push('- Minion Speed is not Anomalous');
        }

        if(this.skeletonGem.qualityId != "Anomalous") {
            this.fixArray.push('- Summon Skeleton is not Anomalous, are you going to use Blessed Rebirth Notable?');
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

        if(this.cdr >= 27 && this.cdr < 52) {
            if(this.crucibleWeaponReducedDuration == true) {
                if(finalReduced != 0.198) {
                    this.fixArray.push('- Check To Dust, it should 24 with less duration mastery or 48 with less duration gem. For 52% cdr, you want 20/20 less duration gem with Summon Skeleton');
                }
            } else {
                // because if you go with To Dusts only, then less duration can't be taken. Only Less duration gem
                if(![34, 58].includes(this.totalDust) ) {
                    this.fixArray.push('- Your To Dust total must be total 34 with less duration mastery on tree or 58 and less duration gem without less duration on tree');
                }
    
                if(this.totalDust == 34 ) {
                    if(this.lessDurationMastery ===  "No") {
                        this.fixArray.push('- You need to allocate Less Duration Mastery on tree or use Less duration gem for 27% CDR');
                    }
                }
            }
            
        }

        // 3.21 only, weapon gets 10% reduced skill duration
        if(this.cdr >=52) {

            // if(![23, 48].includes(this.totalDust) ) {
            //     if(this.minionSpeed.quality > 20) {
            //         this.fixArray.push("+ You are a smart one aren't you?");
            //     } else {
            //         this.fixArray.push('- Your To Dust total must be total 23 + Window Of Opportunity + Less Duration 20/20 or 48 with Less Duration 20/20 for 52 CDR');
            //     }
            // }
            if(reduction!=98) {
                this.fixArray.push('- Total Skeleton Reduction must be 98 with less duration gem');
            }

            if(this.lessDurationMastery ===  "Yes") {
                this.fixArray.push('- Less Duration Mastery is not required for 52% cdr, use a 20/20 Less Duration Gem with Summon Skeletons, see #check-list');
            }

        }

        if(this.cdr < 27 && this.lessDurationMastery ===  "Yes") {
            this.fixArray.push("- Your CDR is less than 27%, remove less duration mastery");
        }

        const isBalbala = data.toString().match(/Balbala/gm);

        if(isBalbala==null) {
            this.fixArray.push('- Your Timeless Jewel is not Balbala')
        }

        if(!Number.isInteger(this.playerStats['Ward'])) {
            this.playerStats['Ward'] = parseInt(this.playerStats['Ward']);
        }

        const vaalSummonSkeletons = data.toString().match(/Vaal Summon Skeletons/gm);
        if(vaalSummonSkeletons!= null) {
            this.fixArray.push('- Vaal Summon Skeletons bricks the build, use normal');
        }

        const buffsExpireSoon = this.pobString.match(/Buffs on you expire/gm);
        if(buffsExpireSoon!=null) {
            this.fixArray.push("- Weapon has crucible modifer buffs expire soon, this will break flask buffs");
        }

        if(this.loopRingsCount === 1) {
            if(this.manaRecoup <= 20) {
                this.fixArray.push("- Mana recoup is 20, you may need more recoup with signle Heartbound Loop Ring Setup");
            }
        }
   
        if(this.treeData.match(/8281/gm)!=null) {
            const lightOne = data.toString().match(/Adds \d+ to \d+ Lightning Damage( to Spells)?/gm);
            const lightTwo = data.toString().match(/\d+ to \d+ Added Spell Lightning Damage (while holding a Shield|while wielding a Two Handed Weapon)/gm);
            if(lightOne == null && lightTwo == null) {
                this.fixArray.push('- Missing Lightning Damage to spells for Elementalist Ascendancy');
            }
        }

        if(this.playerStats['Ward'] >= this.frDamage ) {
            this.frWard = "Yes - Good";
        } else {
            this.fixArray.push('- Ward is less than FR damage. Remove Mind Over Matter Keystone.');
            const damageExcess = this.frDamage - this.playerStats['Ward'];
            if(damageExcess > 200) {

                this.fixArray.push('- You are taking ' + damageExcess + ' damage to your life pool from Forbidden Rite');
            }
            this.fixArray.push('- Increase Chaos Resistance or reduce life pool, Please see https://returnx.github.io/cwdt/');
        }
        
        return Promise.resolve();
    }

    initLoopDamage(data : string) {
        // Math time now

        // const ringList = data.toString().match(/\d+ Physical Damage taken on Minion Death/);
        
        let skeletonCount = 2;

        const skeletonLevel = parseInt(this.skeletonGem.level);

        if(skeletonLevel > 10) {
            skeletonCount = 3;
        }

        if(skeletonLevel >=19 ) {
            skeletonCount = 4;
        }
        
        this.skeletonDamage = this.skeletonDamage * skeletonCount;

        this.frDamage = Math.floor((parseInt(this.playerStats['Life']) * 0.4  
                        + parseInt(this.playerStats['EnergyShield']) * 0.25) 
                        * (1 - parseInt(this.playerStats['ChaosResist'])/100));
        
        this.totalLoopDamage = this.skeletonDamage + this.frDamage;

        let gemPlus = 0;

        const loyal = data.toString().match(/Skin of the Loyal/gm);
        if(loyal!=null) gemPlus = 1;

        const lords = data.toString().match(/Skin of the Lords/gm);
        if(lords!=null) gemPlus = 2;

        const gLevel = parseInt(this.bodyCWDT.level) + gemPlus - 1;
        // 0 based array, so -1

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

                    if(slot.Gem[i].$.nameSpec === 'Summon Skeletons' || slot.Gem[i].$.nameSpec === 'Vaal Summon Skeletons') {
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

                    if(slot.Gem[i].$.nameSpec === "Less Duration") {
                        if(slot.$.slot === "Weapon 1") {
                            this.setGemData(this.lessDuration, slot.Gem[i].$, slot.$.slot );
                        }
                    }
                }
            }
        }
    }

}