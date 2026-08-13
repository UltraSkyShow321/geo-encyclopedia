import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { preferences } from '@kit.ArkData';

const DEFAULT_URL = 'https://你的NAS地址';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    // 预取服务器地址
    try {
      const prefs = preferences.getPreferencesSync(this.context, { name: 'geo_settings' });
      const saved = prefs.getSync('server_url', DEFAULT_URL) as string;
      AppStorage.setOrCreate('serverUrl', saved);
    } catch (e) {
      AppStorage.setOrCreate('serverUrl', DEFAULT_URL);
    }
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        console.error('加载失败: ' + JSON.stringify(err));
        return;
      }
    });
  }
}
