const { withAndroidManifest } = require('expo/config-plugins');

/**
 * 共享清单的后端是 `http://YOUR_SERVER_IP:8080` 这种明文地址，
 * 而 Android 9（API 28）以后默认禁止明文 HTTP 请求 —— 不打开这个开关，
 * 手机上根本连不上后端，只会报网络错误。
 *
 * 只影响 Android 原生工程；生成出来的 AndroidManifest 里会多一行
 * `android:usesCleartextTraffic="true"`。
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults?.manifest?.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
