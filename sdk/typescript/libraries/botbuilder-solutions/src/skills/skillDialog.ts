/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ActivityTypes,
    TurnContext, 
    ConversationState,
    SkillHttpClient} from 'botbuilder';
import {
    DialogContext,
    DialogInstance,
    DialogReason,
    DialogTurnResult, 
    Dialog} from 'botbuilder-dialogs';
import { EnhancedBotFrameworkSkill } from './enhancedBotFrameworkSkill';
import { SkillDialogArgs } from './skillDialogArgs';
import { IBotSettingsBase } from '../botSettings';
import { Activity, IMessageActivity } from 'botframework-schema';
import { ActivityEx } from '../extensions';

/**
 * A sample dialog that can wrap remote calls to a skill.
 * @remarks The options parameter in BeginDialogAsync must be a SkillDialogArgs instance with the initial parameters for the dialog.
 */
export class SkillDialog extends Dialog {
    private readonly botId: string; 
    private readonly conversationState: ConversationState;
    private readonly skillClient: SkillHttpClient;
    private readonly skill: EnhancedBotFrameworkSkill;
    private readonly skillHostEndpoint: string;

    public constructor(
        conversationState: ConversationState,
        skillClient: SkillHttpClient,
        skill: EnhancedBotFrameworkSkill,
        configuration: IBotSettingsBase,
        skillHostEndpoint: string
    ) {
        super(SkillDialog.name);
        if (configuration === undefined) { throw new Error ('configuration has no value') }
        if (configuration.microsoftAppId === undefined || configuration.microsoftAppId === "") { throw new Error ('The bot ID is not in configuration') }
        if (skillClient === undefined) { throw new Error ('skillClient has no value') }
        if (skill === undefined) { throw new Error ('skill has no value') }
        if (conversationState === undefined) { throw new Error ('conversationState has no value') }
        
        this.botId = configuration.microsoftAppId;
        this.skillHostEndpoint = skillHostEndpoint;
        this.skillClient = skillClient;
        this.skill = skill;
        this.conversationState = conversationState;
    }

    /**
     * When a SkillDialog is started, a skillBegin event is sent which firstly indicates the Skill is being invoked in Skill mode,
     * also slots are also provided where the information exists in the parent Bot.
     * @param dc inner dialog context.
     * @param options options
     * @returns dialog turn result.
     */
    public async beginDialog(dc: DialogContext, options?: object): Promise<DialogTurnResult> {
        if (!(options instanceof SkillDialogArgs)) {
            throw new Error("Unable to cast 'options' to SkillDialogArgs");
        }
        
        let dialogArgs: SkillDialogArgs = options;
        let skillId = dialogArgs.skillId;
        await dc.context.sendTraceActivity(`${ SkillDialog.name }.onBeginDialog()`, undefined, undefined, `Using activity of type: ${ dialogArgs.activityType }`);
        
        let skillActivity: Activity;

        switch (dialogArgs.activityType) {
            case ActivityTypes.Event:
                    let eventActivity = ActivityEx.createEventActivity();
                    eventActivity.name = dialogArgs.name;
                    eventActivity.relatesTo = dc.context.activity.relatesTo;
                    skillActivity = <Activity>eventActivity;
                break;
            case ActivityTypes.Message:
                    let messageActivity = ActivityEx.createMessageActivity();
                    messageActivity.text = dc.context.activity.text;
                    skillActivity = <Activity>messageActivity;
                break;
            default:
                throw new Error(`Invalid activity type in ${ dialogArgs.activityType } in ${ SkillDialogArgs.name }`)
        }
        
        this.applyParentActivityProperties(dc.context, skillActivity, dialogArgs);
        return await this.sendToSkill(skillActivity, dc);
    }

    /**
     * All subsequent messages are forwarded on to the skill.
     * @param innerDC Inner Dialog Context.
     * @returns DialogTurnResult.
     */
    protected async onContinueDialog(dc: DialogContext): Promise<DialogTurnResult> {
        dc.continueDialog
        await dc.context.sendTraceActivity(`${ SkillDialog.name }.onContinueDialog()`, undefined, undefined, `ActivityType: ${ dc.context.activity.type }`);
        
        if (dc.context.activity.type === ActivityTypes.EndOfConversation)
        {
            await dc.context.sendTraceActivity(`${ SkillDialog.name }.onContinueDialog()`, undefined, undefined, 'Got EndOfConversation');
            return await dc.endDialog(dc.context.activity.value);
        }

        // Just forward to the remote skill
        return await this.sendToSkill(dc.context.activity, dc);
    }

    public async  ResumeDialog (dc: DialogContext, reason: DialogReason, result: Object): Promise<DialogTurnResult> {
        return SkillDialog.EndOfTurn;
    }

    public async endDialog(turnContext: TurnContext, instance: DialogInstance, reason: DialogReason): Promise<void> {
        if (reason === DialogReason.cancelCalled || reason === DialogReason.replaceCalled) {
            await turnContext.sendTraceActivity(`${ SkillDialog.name }.endDialog()`, undefined, undefined, `ActivityType: ${turnContext.activity.type}`);

            const activity: Activity = <Activity>ActivityEx.createEndOfConversationActivity();
            this.applyParentActivityProperties(turnContext, activity);

            await this.sendToSkill(activity, undefined);
        }

        await super.endDialog(turnContext, instance, reason);
    }

    private applyParentActivityProperties(turnContext: TurnContext, skillActivity: Activity, dialogArgs?: SkillDialogArgs) {
        // Apply conversation reference and common properties from incoming activity before sending.
        skillActivity.relatesTo = turnContext.activity.relatesTo;
        skillActivity.channelData = turnContext.activity.channelData;
        // skillActivity.properties = turnContext.activity.properties; PENDING

        if (dialogArgs !== undefined)
        {
            skillActivity.value = dialogArgs?.value
        }
    }

    private async sendToSkill(activity: Activity, dc?: DialogContext): Promise<DialogTurnResult> {
        if (dc !== undefined)
        {
            // Always save state before forwarding
            // (the dialog stack won't get updated with the skillDialog and things won't work if you don't)
            await this.conversationState.saveChanges(dc.context, true);
        }

        const response = await this.skillClient.postToSkill(this.botId, this.skill, this.skillHostEndpoint, activity);
        if (!(response.status >= 200 && response.status <= 299))
        {
            throw new Error (`Error invoking the skill id: "${ this.skill.Id }" at "${ this.skill.SkillEndpoint }" (status is ${ response.status }).\r\n${ response.body }`);
        }

        return SkillDialog.EndOfTurn;
    }
}
