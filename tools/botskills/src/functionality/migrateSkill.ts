/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ConsoleLogger, ILogger} from '../logger';
import { IMigrateConfiguration, IAppSetting, ISkill, ISkillFileV1 } from '../models';
import { manifestV1Validation } from '../utils/validationUtils';

export class MigrateSkill {
    public logger: ILogger;
    public constructor(logger?: ILogger) {
        this.logger = logger || new ConsoleLogger();
    }
    public async migrateSkill(configuration: IMigrateConfiguration): Promise<boolean> {
        try {
            // Take source file Skills configurations
            const sourceAssistantSkills: ISkillFileV1 = JSON.parse(readFileSync(configuration.sourceFile, 'UTF8'));
            if (sourceAssistantSkills.skills === undefined || sourceAssistantSkills.skills.length === 0) {
                this.logger.message('There are no Skills in the source file.');

                return false;
            }

            const destFile: IAppSetting = JSON.parse(readFileSync(configuration.destFile, 'UTF8'));

            const destAssistantSkills: ISkill[] = destFile.botFrameworkSkills || [];

            sourceAssistantSkills.skills.forEach((skill): void => {
                manifestV1Validation(skill, this.logger);
                if (!this.logger.isError){

                    if (destAssistantSkills.find((assistantSkill: ISkill): boolean => assistantSkill.id === skill.id)) {
                        this.logger.warning(`The skill with ID '${ skill.id }' is already registered.`);
                        return;
                    }

                    destAssistantSkills.push({
                        id: skill.id,
                        appId: skill.msaAppId,
                        skillEndpoint: skill.endpoint,
                        name: skill.name,
                        description: skill.description
                    });
                }
                else {
                    throw new Error(`The skill '${ skill.name }' has an incorrect format. Please check that your manifest complies with one of the manifests in the Microsoft botframework-solutions repository`);
                }
            });

            destFile.botFrameworkSkills = destAssistantSkills;
            writeFileSync(configuration.destFile, JSON.stringify(destFile, undefined, 4));

            this.logger.success(`Successfully migrated all the skills to the new version.`);
            this.logger.warning(`You may now delete the skills.json file.`);
            return true;
        } catch (err) {
            this.logger.error(`There was an error while migrating the Skills:\n ${ err }`);

            return false;
        }
    }
}
