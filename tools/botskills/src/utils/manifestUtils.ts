import { IManifest } from '../models/manifest';
import { isAbsolute, join, resolve, basename } from 'path';
import { get } from 'request-promise-native';
import { existsSync, readFileSync } from 'fs';
import { ISkillManifestV1, IAction, IUtteranceSource } from '../models/manifestV1/skillManifestV1';
import { ISkillManifestV2, IModel, IEndpoint } from '../models/manifestV2/skillManifestV2';
import { ILogger } from '../logger/logger';
import { manifestV2Validation, manifestV1Validation } from './validationUtils';
import { IConnectConfiguration } from '../models';

export class ManifestUtils {
    public static async getManifest(configuration: IConnectConfiguration, logger: ILogger): Promise<IManifest> {
        const rawManifest: string = configuration.localManifest
            ? this.getLocalManifest(configuration.localManifest)
            : await this.getRemoteManifest(configuration.remoteManifest);
    
        const tempManifest = JSON.parse(rawManifest);
        const manifest: IManifest | undefined = tempManifest.id !== undefined
            ? await this.getManifestFromV1(tempManifest, logger)
            : tempManifest.$id !== undefined
                ? await this.getManifestFromV2(tempManifest, configuration.endpointName, logger)
                : undefined;
    
        if (manifest === undefined) {
            throw new Error('Your Skill Manifest is not compatible. Please note that the minimum supported manifest version is 2.1.');
        }
        
        return manifest;
    }

    private static async getRemoteManifest(manifestURI: string): Promise<string> {
        try {
            return get({
                uri: manifestURI,
                json: true
            });
        } catch (err) {
            throw new Error(`There was a problem while getting the remote manifest:\n${ err }`);
        }
    }
    
    private static getLocalManifest(manifestFilepath: string): string {
        const manifestPath: string = manifestFilepath;
        const skillManifestPath: string = isAbsolute(manifestPath) ? manifestPath : join(resolve('./'), manifestPath);
    
        if (!existsSync(skillManifestPath)) {
            throw new Error(`The 'localManifest' argument leads to a non-existing file.
Please make sure to provide a valid path to your Skill manifest using the '--localManifest' argument.`);
        }
    
        return readFileSync(skillManifestPath, 'UTF8');
    }
    
    private static async getManifestFromV1(manifest: ISkillManifestV1, logger: ILogger): Promise<IManifest> {
        manifestV1Validation(manifest, logger);
        if (logger.isError) {
            throw new Error(`One or more properties are missing from your Skill Manifest`);
        }

        return {
            id: manifest.id,
            name: manifest.name,
            description: manifest.description,
            msaAppId: manifest.msaAppId,
            endpoint: manifest.endpoint,
            luisDictionary: await this.processManifestV1(manifest),
            version: '',
            schema: ''
        }
    }

    private static async getManifestFromV2(manifest: ISkillManifestV2, endpointName: string, logger: ILogger): Promise<IManifest> {
        manifestV2Validation(manifest, logger);
        if (logger.isError) {
            throw new Error(`One or more properties are missing from your Skill Manifest`);
        }
        const endpoint: IEndpoint = manifest.endpoints.find((endpoint: IEndpoint): boolean => endpoint.name === endpointName)
        || manifest.endpoints[0];

        return {
            id: manifest.$id,
            name: manifest.name,
            description: manifest.description,
            msaAppId: endpoint.msAppId,
            endpoint: endpoint.endpointUrl,
            luisDictionary: await this.processManifestV2(manifest),
            version: manifest.version,
            schema: manifest.$schema,
            entries: Object.entries(manifest?.dispatchModels.languages)
        }
    }

    private static async processManifestV1(manifest: ISkillManifestV1): Promise<Map<string, string[]>> {

        return manifest.actions.filter((action: IAction): IUtteranceSource[] =>
            action.definition.triggers.utteranceSources).reduce((acc: IUtteranceSource[], val: IAction): IUtteranceSource[] => acc.concat(val.definition.triggers.utteranceSources), [])
            .reduce((acc: Map<string, string[]>, val: IUtteranceSource): Map<string, string[]> => {
                const luisApps: string[] = val.source.map((v: string): string => v.split('#')[0]);
                if (acc.has(val.locale)) {
                    const previous: string[] = acc.get(val.locale) || [];
                    const filteredluisApps: string[] = [...new Set(luisApps.concat(previous))];
                    acc.set(val.locale, filteredluisApps);
                } else {
                    const filteredluisApps: string[] = [...new Set(luisApps)];
                    acc.set(val.locale, filteredluisApps);
                }

                return acc;
            },
            new Map());
    }

    private static async processManifestV2(manifest: ISkillManifestV2): Promise<Map<string, string[]>> {
        const acc: Map<string, string[]> = new Map();
        const entries = Object.entries(manifest.dispatchModels.languages);

        entries.forEach(([locale, value]): void => {
            const luisApps: string[] = [];
            value.forEach((model: IModel): void => {
                luisApps.push(model.id);
            });
        
            const filteredluisApps: string[] = [...new Set(luisApps)]
            acc.set(locale, filteredluisApps);
        });

        return acc;
    }
}