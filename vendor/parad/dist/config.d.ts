import type { ClientConfig } from './types.js';
/** Current config directory, read at call time (PARADOX_HOME override). */
export declare function configDir(): string;
export declare function loadConfig(configPath?: string): ClientConfig;
export declare function getDefaultConfigPath(): string;
export declare function saveConfig(config: ClientConfig, configPath?: string): void;
//# sourceMappingURL=config.d.ts.map