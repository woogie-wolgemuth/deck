/* tslint:disable: no-console */
import { module } from 'angular';
import { cloneDeep, uniq, without } from 'lodash';

import { SETTINGS } from 'core/config/settings';

export interface ICloudProviderLogo {
  path: string;
}

export interface ICloudProviderConfig {
  name: string;
  logo?: ICloudProviderLogo;
  providerVersion?: string;
  skin?: string;
  defaultSkin?: boolean;
  [attribute: string]: any;
}

class Providers {

  private providers: { cloudProvider: string, config: ICloudProviderConfig }[] = [];

  public set(cloudProvider: string, config: ICloudProviderConfig): void {
    // The original implementation used a Map, so calling #set could overwrite a config.
    // The tests depend on this behavior, but maybe something else does as well.
    this.providers = without(
      this.providers,
      this.providers.find(p => p.cloudProvider === cloudProvider && p.config.skin === config.skin)
    ).concat([{ cloudProvider, config }]);
  }

  public get(cloudProvider: string, skin?: string): ICloudProviderConfig {
    if (skin) {
      const provider = this.providers.find(p => p.cloudProvider === cloudProvider && p.config.skin === skin);
      return provider ? provider.config : this.getDefaultSkin(cloudProvider);
    } else {
      return this.getDefaultSkin(cloudProvider);
    }
  }

  public has(cloudProvider: string, skin?: string): boolean {
    return !!this.get(cloudProvider, skin);
  }

  public keys(): string[] {
    return uniq(this.providers.map(p => p.cloudProvider));
  }

  private getDefaultSkin(cloudProvider: string): ICloudProviderConfig {
    const provider = this.providers.some(p => p.cloudProvider === cloudProvider && p.config.defaultSkin)
      ? this.providers.find(p => p.cloudProvider === cloudProvider && p.config.defaultSkin)
      : this.providers.find(p => p.cloudProvider === cloudProvider);
    return provider ? provider.config : null;
  }
}

export class CloudProviderRegistry {
  /*
  Note: Providers don't get $log, so we stick with console statements here
   */
  private providers = new Providers();

  public $get(): CloudProviderRegistry {
    return this;
  }

  public registerProvider(cloudProvider: string, config: ICloudProviderConfig): void {
    if (SETTINGS.providers[cloudProvider]) {
      this.providers.set(cloudProvider, config);
    }
  }

  public getProvider(cloudProvider: string, skin?: string): ICloudProviderConfig {
    return this.providers.has(cloudProvider, skin) ? cloneDeep(this.providers.get(cloudProvider, skin)) : null;
  }

  public listRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  public overrideValue(cloudProvider: string, key: string, overrideValue: any, skin?: string) {
    if (!this.providers.has(cloudProvider, skin)) {
      console.warn(`Cannot override "${key}" for provider "${cloudProvider}${skin ? `:${skin}` : ''}" (provider not registered)`);
      return;
    }
    const config = this.providers.get(cloudProvider, skin),
      parentKeys = key.split('.'),
      lastKey = parentKeys.pop();
    let current = config;

    parentKeys.forEach((parentKey) => {
      if (!current[parentKey]) {
        current[parentKey] = {};
      }
      current = current[parentKey];
    });

    current[lastKey] = overrideValue;
  }

  public hasValue(cloudProvider: string, key: string, skin?: string) {
    return this.providers.has(cloudProvider, skin) && this.getValue(cloudProvider, key, skin) !== null;
  }

  public getValue(cloudProvider: string, key: string, skin?: string): any {
    if (!key || !this.providers.has(cloudProvider, skin)) {
      return null;
    }
    const config = this.getProvider(cloudProvider, skin),
      keyParts = key.split('.');
    let current = config,
      notFound = false;

    keyParts.forEach((keyPart) => {
      if (!notFound && current.hasOwnProperty(keyPart)) {
        current = current[keyPart];
      } else {
        notFound = true;
      }
    });

    if (notFound) {
      console.debug(`No value configured for "${key}" in provider "${cloudProvider}"`);
      return null;
    }
    return current;
  }

}

export const CLOUD_PROVIDER_REGISTRY = 'spinnaker.core.cloudProvider.registry';
module(CLOUD_PROVIDER_REGISTRY, [])
  .provider('cloudProviderRegistry', CloudProviderRegistry);
