/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */
import {
    DialogTurnResult,
    WaterfallStepContext,
    WaterfallDialog,
    TextPrompt,
    PromptOptions } from 'botbuilder-dialogs';
import { SkillDialogBase } from './skillDialogBase';
import { BotTelemetryClient, StatePropertyAccessor, Activity } from 'botbuilder';
import { BotServices } from '../services/botServices';
import { LocaleTemplateEngineManager } from 'botbuilder-solutions';
import { SkillState } from '../models/skillState';
import { IBotSettings } from '../services/botSettings';
import { SampleDialog } from './sampleDialog';

export class SampleActionInput {
    name = ''
}

export class SampleActionOutput {
    customerId = ''
}

export class SampleAction extends SkillDialogBase {
    private readonly nameKey: string = 'name';

    public constructor (
        settings: Partial<IBotSettings>,
        services: BotServices,
        stateAccessor: StatePropertyAccessor<SkillState>,
        telemetryClient: BotTelemetryClient,
        templateEngine: LocaleTemplateEngineManager
    ) {
        super(SampleDialog.name, settings, services, stateAccessor, telemetryClient, templateEngine);
        
        const sample: ((sc: WaterfallStepContext) => Promise<DialogTurnResult>)[] = [
            this.promptForName.bind(this),
            this.greetUser.bind(this),
            this.end.bind(this)
        ];

        this.addDialog(new WaterfallDialog(SampleAction.name, sample));
        this.addDialog(new TextPrompt(DialogIds.namePrompt));

        const initialDialogId: string = SampleAction.name;
    }

    private async promptForName(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        // If we have been provided a input data structure we pull out provided data as appropriate
        // and make a decision on whether the dialog needs to prompt for anything.
        const actionInput = stepContext.options as SampleActionInput;

        if (actionInput !== null && actionInput.name.trim().length > 0) {
            // We have Name provided by the caller so we skip the Name prompt.
            return await stepContext.next(actionInput.name);
        }

        const prompt: Partial<Activity> = this.templateEngine.generateActivityForLocale("NamePrompt");
        return await stepContext.prompt(DialogIds.namePrompt, { prompt: prompt });
    }

    private async greetUser(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        const tokens: Map<string, string> = new Map<string, string>();
        tokens.set(this.nameKey, stepContext.result as string);

        const response = this.templateEngine.generateActivityForLocale("HaveNameMessage", tokens);
        await stepContext.context.sendActivity(response);

        // Pass the response which we'll return to the user onto the next step
        return await stepContext.next();
    }

    private async end(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        // Simulate a response object payload
        const actionResponse = new SampleActionOutput();
        actionResponse.customerId = Math.random().toString();

        // We end the dialog (generating an EndOfConversation event) which will serialize the result object in the Value field of the Activity
        return await stepContext.endDialog(actionResponse);
    }
}

enum DialogIds {
    namePrompt = 'namePrompt'
}