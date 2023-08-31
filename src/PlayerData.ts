/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Message } from 'discord.js';
import * as zlib from 'node:zlib'
import xml2js from 'xml2js';
import { Recoup } from './Recoup';
import { Validate } from './Validate';

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
    skeletonEmpower : any = {};
    frLinkedToSkeleton = false;

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
    skeletonGemLevel = 0;

    crucibleWeaponReducedDuration = false;

    playerClass  = "";

    treeData : any;
    pobString : any;

    fixArray : string[] = [];

    lords : RegExpMatchArray | null = null;
    loyal : RegExpMatchArray | null = null;

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

        const valid = new Validate(this);
        if(!valid.isValid()) return Promise.resolve();

        const recoup : Recoup = new Recoup();
        recoup.recoup(this);


        this.loyal = data.toString().match(/Skin of the Loyal/gm);
        this.lords = data.toString().match(/Skin of the Lords/gm);

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
        

        // 3.22 Tattoos
        let turtleMultiplier = 0;
        const turtleArray = data.toString().match(/3% increased Global Defences/gm);
        if(turtleArray != null) {
            turtleMultiplier = turtleArray.length * 3;
            turtleMultiplier = turtleMultiplier /100;
        }

        multiplier = multiplier + flaskMulti + turtleMultiplier;

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

        this.checkGemLinks();
        this.initLoopDamage(data);

        // Skeleton Duration
        const toDustArray = data.toString().match(/\d\d[%] reduced Skeleton Duration/gm);
        if(toDustArray!=null) {
            for(const item of toDustArray!) {
                this.totalDust = this.totalDust + parseInt( item.substring(0, 2) );
            }    
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
        
        if(Object.keys(this.lessDuration).length != 0) {

            let less = 39 + (parseInt(this.lessDuration.level) + 1) / 2
            less = Math.floor(less);

            less = less + Math.floor(parseInt(this.lessDuration.quality) * 0.5);

            finalReduced = finalReduced * ( 1 - less/100);
        }

        if(finalReduced > 0.198 && finalReduced <= 0.231) {
            this.skeletonDuration = 0.231;
        }

        if(finalReduced > 0.231) {
            this.skeletonDuration = finalReduced;
            if(this.skeletonDuration > 0.250) {
                this.fixArray.push('- Check To Dusts and Reduced/Increased duration of skills on passive tree and also items');
            }
        }

        if(finalReduced > 0.165 &&  finalReduced <= 0.198) {
            this.skeletonDuration = 0.198;
        }

        if(finalReduced < 0.165 && finalReduced > 0.132) {
            this.skeletonDuration = 0.165;
        }

        if(finalReduced < 0.132) {
            this.fixArray.push('- Check To Dusts and Reduced/Increased duration of skills on passive tree and also items');
        }

        // Physical hits as elemental damage
        const physAsEle = data.toString().match(/\d+[%] of Physical Damage from Hits taken as (Cold|Fire|Lightning) Damage$/gm);

        if(physAsEle != null) {
            this.physAsEle = "Yes"
            this.fixArray.push("- Remove Helm Implicit Phys as ele damage taken mod")
        }

        const cdrList = data.toString().match(/\d+% increased Cooldown Recovery Rate$/gm)
        if(cdrList!=null) {
            for(const cdrMod of cdrList) {
                this.cdr = this.cdr + parseInt(cdrMod.substring(0, cdrMod.indexOf('%')));
            }
        }

        // Sabo CDR
        if(this.treeData.match(/51462/)!=null) {
            this.cdr = this.cdr + 30;
        }

        const cryCDR = this.pobString.match(/Cry has \d+% increased Cooldown Recovery Rate/gm); 
        if(cryCDR!=null) {
            this.fixArray.push("- Please remove Warcry boot implicit and try again");
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
            this.fixArray.push('- Remove Increased Effect Of Flasks from items, tree and tattoos. This reduces your Ward');
        }

        const wandCheck = data.toString().match(/Spectral Spirits when Equipped/gm);
        if(wandCheck != null) {
            this.swapWandCount = wandCheck.length;
            if(this.skeletonCWDT.level >= 19 ) {
                if(this.swapWandCount === 1) {
                    this.fixArray.push('- Use 2 - Swap Wands with Essence of Insanity');
                }
            }
        } else {
            this.fixArray.push('- Missing Swap Wands, craft using Essence of Insanity');
        }

        if(this.playerStats['Armour'] !== '0') {
            this.fixArray.push('- Armor is not 0, this must be 0');
        }

        if(this.minionSpeed.quality < 20) {
            this.fixArray.push('- Minion Speed is not 20% quality');
        }

        if(this.minionSpeed.qualityId != "Anomalous") {
            this.fixArray.push('- Minion Speed is not Anomalous');
        }

        if(this.skeletonGem.qualityId != "Anomalous") {
            if(data.toString().match(/Blessed Rebirth/) == null) {
                this.fixArray.push('- Summon Skeleton is not Anomalous, either buy Anomalous or Use Blessed Rebirth notable cluster jewel'); 
            }
        }

        if(this.cdr < 9) {
            this.fixArray.push('- Missing 9% cdr, craft on belt or boots');
            if(![34, 59].includes(this.totalDust) ) {
                this.fixArray.push('- For 9%-26% CDR, To Dust Total Reduced Skeleton Duration must be 34 + Window Of Opporutnity Notable OR 59 Without Window Of Opportunity Notable');
            }
        }

        if(this.cdr > 9 && this.cdr <27 ) {
            if(![34, 59].includes(this.totalDust) ) {
                this.fixArray.push('- For 9%-26% CDR, To Dust Total Reduced Skeleton Duration must be 34 + Window Of Opporutnity Notable OR 59 Without Window Of Opportunity Notable');
            }
        }

        if(this.cdr >= 27 && this.cdr < 52) {
            if(this.crucibleWeaponReducedDuration == true) {
                if(this.skeletonDuration != 0.198) {
                    if(this.minionSpeed.quality > 20) {
                        this.fixArray.push('- Check your Skeleton Cooldown and Skill Duration in PoB, there is something wrong.');
                    } else {
                        this.fixArray.push("- Check To Dust, it should be 24 with duration mastery '10% less' or 48 with 4/20 Less Duration gem. Because The Weapon has 10% reduced");
                    }
                }
            } else {
                // because if you go with To Dusts only, then less duration can't be taken. Only Less duration gem
                if(![34, 58].includes(this.totalDust) ) {
                    this.fixArray.push("- To Dust sum must be total 34 with duration mastery on tree '10% less skill effect duration'");
                    this.fixArray.push("- OR Second Option To Dust sum must 58 and 4/20 Less Duration gem without less duration on tree");
                }
    
                if(this.totalDust == 34 ) {
                    if(this.lessDurationMastery ===  "No") {
                        this.fixArray.push("- Allocate Duration Mastery on tree '10% less skill effect duration' OR use 4/20 Less Duration gem for 27% CDR");
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

            if(reduction!=0.98) {
                this.fixArray.push('- Total Skeleton Duration Reduction must be 98 and also use 20/20 Less duration gem. See #check-list');
            }

            if(this.skeletonDuration!=0.165) {
                this.fixArray.push('- Less Duration 20/20 gem required for 52 CDR');
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

        if(this.loopRingsCount === 1) {
            if(this.manaRecoup <= 20) {
                this.fixArray.push("- Mana recoup is 20, craft recoup on ring/amulet (If you have mana issues)");
            }
        }
   
        if(this.treeData.match(/8281/gm)!=null) {
            const lightOne = data.toString().match(/Adds \d+ to \d+ Lightning Damage( to Spells)?/gm);
            const lightTwo = data.toString().match(/\d+ to \d+ Added Spell Lightning Damage (while holding a Shield|while wielding a Two Handed Weapon)/gm);
            if(lightOne == null && lightTwo == null) {
                this.fixArray.push('- Missing Added Lightning Damage to Spells to trigger Elementalist Shock, you are missing damage');
                this.fixArray.push('- Get Added Lightning Damage on Helm Implicit or Ring or Abyss jewel or Tattoo of the Valako Warrior');
                
            }
        }

        if(this.pobString.match(/Allocates Assassin if you have the matching/)) {
            this.fixArray.push("Assassin Flesh/Flame breaks the build");
        }

        if(this.playerStats['Ward'] >= this.frDamage ) {
            this.frWard = "Yes/Good";
        } else {
            if(this.MindOverMatter === "Yes") {
                this.fixArray.push('- Ward is less than FR damage. Remove Mind Over Matter Keystone if loop needs many swaps to start.');
            }
            const damageExcess = this.frDamage - this.playerStats['Ward'];
            this.fixArray.push('- You are taking ' + damageExcess + ' damage to your life pool from Forbidden Rite');
            this.fixArray.push('- Increase Chaos Resistance or increase ward or reduce life pool, Please see https://returnx.github.io/cwdt/');
            if(this.frDamage < 200) {
                this.fixArray.push('- You can ignore this damage to life pool if FR does not kill you');
            }
        }

        return Promise.resolve();
    }

    initLoopDamage(data : Buffer) {
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
        
        // Trigger bots sabo
        if(this.treeData.match(/28535/)!=null) {
            skeletonCount = skeletonCount * 2;
        }

        this.skeletonDamage = this.skeletonDamage * skeletonCount;

        this.frDamage = Math.floor((parseInt(this.playerStats['Life']) * 0.4  
                        + parseInt(this.playerStats['EnergyShield']) * 0.25) 
                        * (1 - parseInt(this.playerStats['ChaosResist'])/100));
        
        this.totalLoopDamage = this.skeletonDamage + this.frDamage;

        let gemPlus = 0;

        if(this.loyal!=null) gemPlus = 1;

        if(this.lords!=null) gemPlus = 2;

        const gLevel = parseInt(this.bodyCWDT.level) + gemPlus;
      
        const cwdtArray = [ 528, 583, 661, 725, 812, 897, 1003, 1107, 1221, 1354, 1485, 1635, 1804, 1980, 2184, 2394, 2621, 2874, 3142, 3272, 3580, 3950, 4350 ];
        let threshold;
        
        if(gLevel <24) {
            // 0 based array, so -1
            threshold= cwdtArray[gLevel - 1];
        } else {
            threshold = 9999;
        }

        if(this.bodyCWDT.qualityId === "Divergent") {
            threshold = threshold * (1 - this.bodyCWDT.quality/100);
        }

        // Case where skeleton threshold is less body threshold, happens with level 21 skeletons

        let skeletonThreshold = cwdtArray[parseInt(this.skeletonCWDT.level)-1];
        if(this.skeletonCWDT.qualityId === "Divergent") {
            skeletonThreshold = skeletonThreshold * (1 - this.skeletonCWDT.quality/100);
        }

        if(skeletonThreshold > this.skeletonDamage + this.frDamage) {
            this.fixArray.push('- Not Enough Forbidden Rite damage to trigger Summon Skeletons, Loop Fails');
        }


        if(this.frLinkedToSkeleton && this.loopRingsCount == 2 && this.skeletonGemLevel <= 20 && this.loyal!=null) {
            if(skeletonLevel>11 || parseInt(this.skeletonCWDT.level) > 5) {
                this.fixArray.push('- Please follow the gem links given below for fast optimal loop');
                this.fixArray.push('- Summon Skeleton Level 11 in helm');
                this.fixArray.push('- CWDT Level 5 in helm');
                this.fixArray.push('- Forbddein Rite Level 1 in helm');
                this.fixArray.push('- Anoamlous Minion Speed 20% quality helm');
            }
        }

        if(this.frLinkedToSkeleton && this.skeletonGemLevel >= 21) {
            this.fixArray.push("- Forbidden Rite Should be linked to CWDT in gloves/boots");
            this.fixArray.push("- Forbidden Rite Should not be linked with Summon Skeletons");
        }

        if(this.frLinkedToSkeleton && this.skeletonGemLevel == 20 && this.loyal == null) {
            this.fixArray.push("- Forbidden Rite Should be linked to CWDT in gloves/boots");
            this.fixArray.push("- Forbidden Rite Should not be linked with Summon Skeletons");
            this.fixArray.push("- Make Summon Skeleton Level 21, using Empower Support or +1 Amulet");
        }

        const cwdtLevelArray = [38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 65, 66, 67, 68, 69, 70, 72, 72, 72];
        const skeletonLevelArray = [10, 13, 17, 21, 25, 29, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 68, 70, 72];
        const frLevelArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

        const skelRequirement = skeletonLevelArray[skeletonLevel-1];
        const skelCWDTSupportMax = cwdtLevelArray[parseInt(this.skeletonCWDT.level)-1];

        const frLevelRequirement = frLevelArray[parseInt(this.forbiddenRite.level)-1];
        const frLevelSupportMax = cwdtLevelArray[parseInt(this.frCWDT.level)-1];

        if(skelRequirement > skelCWDTSupportMax) {
            this.fixArray.push('- Skeleton & CWDT gem levels requirements dont match');
            this.fixArray.push('- Please use the correct Skeleton and CWDT gem levels');
        }

        if(frLevelRequirement > frLevelSupportMax) {
            this.fixArray.push('- Reduce Forbidden Rite Gem Level');
        }

        // checking if FR gem is required

        if(this.skeletonDamage < threshold) {
            if(Object.keys(this.forbiddenRite).length === 0) {
                if(data.toString().match(/ascendClassName="Saboteur"/) == null) {
                    this.fixArray.push("- Forbidden Rite Gem is Missing, this is required for the bot to check if build works");
                }
            }
        }

        if(this.totalLoopDamage >= threshold) {
            this.bodyLoopSpeed = "Full Speed";
        } else {

            if(this.loyal!=null) {
                if(this.bodyCWDT.level > 20) {
                    this.fixArray.push('- CWDT for Skin of the Loyal should be level 20');
                }
            }
    
            if(this.lords!=null) {
                if(this.bodyCWDT.level > 19) {
                    this.fixArray.push('- CWDT for Skin of the Lords should be level 19. OR you should know what you are doing');
                }
            }

            if(this.loopRingsCount === 1) {
                if(this.bodyCWDT.qualityId === "Normal" && this.treeData.match(/28535/) === null) {
                    this.fixArray.push("- Body CWDT Quality Should be Divergent when using only one heartbound ring");
                    this.fixArray.push("- Type help ring in chat and learn how to use only one heartbound ring");
                }
            }
              
            this.fixArray.push('- Loop is either half speed or fails, please use calculator to check https://returnx.github.io/cwdt/');
            this.fixArray.push('- Required Self damage to loop: ' + threshold);
            this.fixArray.push('- Your Loop Self Damage:        ' + this.totalLoopDamage);
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

                            if(slot.Gem[j].$.nameSpec === "Less Duration" && slot.Gem[j].$.enabled === "true") {
                                this.setGemData(this.lessDuration, slot.Gem[j].$, slot.$.slot );
                            }

                            if(slot.Gem[j].$.nameSpec === "Empower" && slot.Gem[j].$.enabled === "true") {
                                this.setGemData(this.skeletonEmpower, slot.Gem[j].$, slot.$.slot );
                            }

                            if(slot.Gem[j].$.nameSpec === "Forbidden Rite" && slot.Gem[j].$.enabled === "true") {
                                this.frLinkedToSkeleton = true;
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

        if(Object.keys(this.skeletonGem).length === 0) {
            this.fixArray.push('- Summon Skeletons is missing');
        }

        if(Object.keys(this.minionSpeed).length === 0) {
            this.fixArray.push('- Minion Speed is missing');
        }

        if(Object.keys(this.bodyCWDT).length === 0) {
            this.fixArray.push('- CWDT Gem in Body is missing, this is required for bot to check');
        }
    }

    checkGemLinks() {

        let skeletonLevel =  parseInt(this.skeletonGem.level);
                
        if(Object.keys(this.skeletonEmpower).length != 0) {
            if(parseInt(this.skeletonEmpower.level) === 2) 
                skeletonLevel = skeletonLevel + 1;
            if(parseInt(this.skeletonEmpower.level) > 2) 
                skeletonLevel = skeletonLevel + 2;
        }

        if(this.pobString.match(/\+1 to Level of all Skill Gems/)!=null) {
            skeletonLevel = skeletonLevel + 1 ;
        }

        if(this.pobString.match(/\+1 to Level of all Intelligence Skill Gems/)!=null) {
            skeletonLevel = skeletonLevel + 1 ;
        }

        this.skeletonGemLevel = skeletonLevel;
        // Sabo check
        if(this.loopRingsCount === 1) {
            if(this.treeData.match(/28535/)===null) {
                if(skeletonLevel < 21) {
                    this.fixArray.push("- Summon Skeleton Gem Level is not 21, to learn more type in chat 'help ring'")
                }
            }
        }
    }
}