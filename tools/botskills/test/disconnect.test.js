/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */

const { strictEqual } = require("assert");
const { writeFileSync } = require("fs");
const { join, resolve } = require("path");
const sandbox = require("sinon").createSandbox();
const testLogger = require("./helpers/testLogger");
const { normalizeContent } = require("./helpers/normalizeUtils");
const botskills = require("../lib/index");
const filledDispatch = normalizeContent(JSON.stringify(
    {
        "services": [
            {
                "name": "testDispatch",
                "id": "1"
            }
        ],
        "serviceIds": [
            "1"
        ]
    },
    null, 4));

    const noAuthConnectionAppSettings = normalizeContent(JSON.stringify(
        {
            "microsoftAppId": "",
            "microsoftAppPassword": "",
            "appInsights": {
                "appId": "",
                "instrumentationKey": ""
            },
            "blobStorage": {
                "connectionString": "",
                "container": ""
            },
            "cosmosDb": {
                "authkey": "",
                "collectionId": "",
                "cosmosDBEndpoint": "",
                "databaseId": ""
            },
            "contentModerator": {
                "key": ""
            }
        },
        null, 4));
    
    const noAuthConnectionAppSettingsWithConnectedSkill = normalizeContent(JSON.stringify(
        {
            "microsoftAppId": "",
            "microsoftAppPassword": "",
            "appInsights": {
                "appId": "",
                "instrumentationKey": ""
            },
            "blobStorage": {
                "connectionString": "",
                "container": ""
            },
            "cosmosDb": {
                "authkey": "",
                "collectionId": "",
                "cosmosDBEndpoint": "",
                "databaseId": ""
            },
            "contentModerator": {
                "key": ""
            },
            "BotFrameworkSkills": [
                {
                    "Id": "connectableSkill",
                    "AppId": "00000000-0000-0000-0000-000000000000",
                    "SkillEndpoint": "https://bftestskill.azurewebsites.net/api/skill/messages",
                    "Name": "Test Skill"
                }
            ],
            "SkillHostEndpoint": "https://.azurewebsites.net/api/skills"
        },
        null, 4));

function undoChangesInTemporalFiles() {
    writeFileSync(resolve(__dirname, join("mocks", "success", "dispatch", "en-us", "filleden-usDispatch.dispatch")), filledDispatch);
    writeFileSync(resolve(__dirname, join("mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json")), noAuthConnectionAppSettingsWithConnectedSkill);
    writeFileSync(resolve(__dirname, join("mocks", "appsettings", "noAuthConnectionAppSettings.json")), noAuthConnectionAppSettings);
}

describe("The disconnect command", function () {
    
    beforeEach(function() {
        undoChangesInTemporalFiles();
        this.logger = new testLogger.TestLogger();
        this.disconnector = new botskills.DisconnectSkill();
        this.disconnector.logger = this.logger;
        this.refreshExecutionStub = sandbox.stub(this.disconnector, "executeRefresh");
        this.refreshExecutionStub.returns(Promise.resolve("Mocked function successfully"));
    });

    after(function() {
        undoChangesInTemporalFiles();
    });

	describe("should show an error", function () {
        it("when there is no skills File", async function () {
            const configuration = {
                skillId : "",
                appSettingsFile : "",
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : "",
                lgOutFolder: resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };
            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();

            strictEqual(errorList[errorList.length - 1], `The 'appSettingsFile' argument is absent or leads to a non-existing file.
Please make sure to provide a valid path to your Assistant Skills configuration file using the '--appSettingsFile' argument.`);
        });

        it("when the appSettingsFile points to a bad formatted Assistant Skills configuration file", async function () {
            const configuration = {
                skillId : "testSkill",
                appSettingsFile: resolve(__dirname, "mocks", "virtualAssistant", "badAppSettings.jso"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : "",
                lgOutFolder: resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();

            strictEqual(errorList[errorList.length - 1], `There was an error while disconnecting the Skill ${configuration.skillId} from the Assistant:
SyntaxError: Unexpected token N in JSON at position 0`);
        });

        it("when there is no cognitiveModels file", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "nonCognitiveModels.json"),
                languages : "",
                dispatchFolder : "",
                lgOutFolder: resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };
            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();
            strictEqual(errorList[errorList.length - 1], `There was an error while disconnecting the Skill ${configuration.skillId} from the Assistant:
Error: An error ocurred while updating the Dispatch model:
Error: Could not find the cognitiveModels file (${configuration.cognitiveModelsFile}). Please provide the '--cognitiveModelsFile' argument.`);
        });

        it("when the dispatchFolder points to a nonexistent path", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : resolve(__dirname, "mocks", "success", "nonexistentDispatch"),
                lgOutFolder: resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();

            strictEqual(errorList[0], `There was an error while disconnecting the Skill connectableSkill from the Assistant:
Error: An error ocurred while updating the Dispatch model:
Error: The path to the dispatch file doesn't exists: ${configuration.dispatchFolder}\\en-us\\filleden-usDispatch.dispatch`);
        });

        it("when the refresh execution fails", async function () {
            sandbox.replace(this.disconnector, "executeRefresh", () => {
                return Promise.reject(new Error("Mocked function throws an Error"));
            });
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : resolve(__dirname, "mocks", "success", "dispatch"),
                lgOutFolder: resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();

            strictEqual(errorList[errorList.length - 1], `There was an error while disconnecting the Skill ${configuration.skillId} from the Assistant:
Error: An error ocurred while updating the Dispatch model:
Error: Mocked function throws an Error`);
        });

        it("when the lgOutFolder argument is invalid ", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : resolve(__dirname, "mocks", "success", "dispatch"),
                lgOutFolder: resolve(__dirname, "mocks", "success", "nonexistentLuis"),
                lgLanguage : "cs",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();

            strictEqual(errorList[errorList.length - 1], `The 'lgOutFolder' argument is absent or leads to a non-existing folder.
Please make sure to provide a valid path to your LUISGen output folder using the '--lgOutFolder' argument.`);
        });

        it("when the lgLanguage argument is invalid", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : resolve(__dirname, "mocks", "success", "dispatch"),
                lgOutFolder : resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const errorList = this.logger.getError();

            strictEqual(errorList[errorList.length - 1], `The 'lgLanguage' argument is incorrect.
It should be either 'cs' or 'ts' depending on your assistant's language. Please provide either the argument '--cs' or '--ts'.`);
        });
    });

    describe("should show a warning", function () {
        it("when the appSettingsFile points to a bad formatted Assistant Skills configuration file", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettings.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : "",
                lgOutFolder : resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const warningList = this.logger.getWarning();

            strictEqual(warningList[warningList.length - 1], `The skill 'connectableSkill' is not present in the assistant Skills configuration file.
Run 'botskills list --appSettingsFile "<YOUR-ASSISTANT-SKILLS-FILE-PATH>"' in order to list all the skills connected to your assistant`);
        });

        it("when the noRefresh flag is applied", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                luisFolder : "",
                dispatchFolder : resolve(__dirname, "mocks", "success", "dispatch"),
                lgOutFolder : resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger,
                noRefresh: "true"
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const warningList = this.logger.getWarning();

            strictEqual(warningList[warningList.length - 1], `Run 'botskills refresh --cs' command to refresh your connected skills`);
        });
    });

    describe("should show a success message", function () {
        it("when the skill is successfully disconnected", async function () {
            const configuration = {
                skillId : "connectableSkill",
                appSettingsFile: resolve(__dirname, "mocks", "appsettings", "noAuthConnectionAppSettingsWithConnectedSkill.json"),
                outFolder : "",
                cognitiveModelsFile : resolve(__dirname, "mocks", "cognitivemodels", "cognitivemodelsWithTwoDispatch.json"),
                languages : "",
                dispatchFolder : resolve(__dirname, "mocks", "success", "dispatch"),
                lgOutFolder : resolve(__dirname, "mocks", "success", "luis"),
                lgLanguage : "cs",
                logger : this.logger
            };

            this.disconnector.configuration = configuration;
            await this.disconnector.disconnectSkill();
            const successList = this.logger.getSuccess();

			strictEqual(successList[successList.length - 1], `Successfully removed '${configuration.skillId}' skill from your assistant's skills configuration file.`);
        });
	});
});
