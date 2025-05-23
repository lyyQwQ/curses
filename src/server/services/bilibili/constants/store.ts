import { version } from '../../../../../package.json'
import { configDir } from '@tauri-apps/api/path'
import { readDir, createDir } from "@tauri-apps/api/fs";

const STORE_DEFAULT_VALUES: Record<string, any> = {
  version
};

// 初始化存储路径和目录
const initStorePath = async () => {
  const STORE_DEFAULT_PATH = await configDir() + 'bili-bot';
  // 首次打开时创建配置文件夹
  await readDir(STORE_DEFAULT_PATH).catch(async () => {
    await createDir(STORE_DEFAULT_PATH);
  });
  return STORE_DEFAULT_PATH;
}

export { STORE_DEFAULT_VALUES, initStorePath };