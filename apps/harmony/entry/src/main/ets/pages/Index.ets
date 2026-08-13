import { webview } from '@kit.ArkWeb';
import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';

@Entry
@Component
struct Index {
  @State serverUrl: string = AppStorage.get<string>('serverUrl') || 'https://你的NAS地址'
  @State showSettings: boolean = false
  controller: webview.WebviewController = new webview.WebviewController()

  saveUrl(): void {
    const context = getContext(this) as common.UIAbilityContext
    const prefs = preferences.getPreferencesSync(context, { name: 'geo_settings' })
    prefs.putSync('server_url', this.serverUrl)
    prefs.flush()
    AppStorage.setOrCreate('serverUrl', this.serverUrl)
    this.showSettings = false
    this.controller.loadUrl(this.serverUrl)
  }

  build() {
    Column() {
      if (this.showSettings) {
        Column({ space: 12 }) {
          Text('服务器设置').fontSize(20).fontWeight(FontWeight.Bold).margin({ top: 40 })
          TextInput({ text: this.serverUrl, placeholder: 'https://你的NAS地址' })
            .onChange((v: string) => { this.serverUrl = v })
            .margin({ left: 24, right: 24 })
          Button('保存并连接').onClick(() => this.saveUrl()).width(180)
          Button('取消').onClick(() => { this.showSettings = false }).width(180).backgroundColor('#64748b')
        }
        .width('100%').height('100%').backgroundColor('#f8fafc')
      } else {
        Stack() {
          Web({ src: this.serverUrl, controller: this.controller })
            .javaScriptAccess(true)
            .domStorageAccess(true)
            .fileAccess(true)
            .onErrorReceive((event) => {
              console.error('页面加载失败: ' + JSON.stringify(event))
              this.showSettings = true
            })
            .width('100%').height('100%')
          Button('设置')
            .position({ x: 12, y: 24 })
            .opacity(0.85)
            .onClick(() => { this.showSettings = true })
        }
      }
    }
    .width('100%').height('100%')
  }
}
