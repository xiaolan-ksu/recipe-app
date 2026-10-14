import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from './PrimaryButton';
import {
  CAN_UPDATE,
  checkApk,
  checkOta,
  downloadApk,
  fetchOta,
  formatSize,
  installApk,
  openInstallPermissionSettings,
  restartIntoUpdate,
  runningInfo,
  type ApkRelease,
  type CheckOutcome,
} from '../lib/updates';
import { colors, radius, screenPadding, spacing, typography } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}

type Phase =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'uptodate'
  | 'ota'
  | 'downloading'
  | 'backgroundDownload'
  | 'otaReady'
  | 'apk'
  | 'apkDownloading'
  | 'installing'
  | 'problem';

/** 检查更新最多等这么久，超了就直说，别一直转圈 */
const CHECK_TIMEOUT_MS = 15000;

/**
 * expo-updates 的检查和下载是**排队串行**跑的：后台正在下新版时再插一次检查，
 * 会一直排在下载后面，界面上看起来就是永远转圈。所以给检查加个上限，
 * 到点就当这次没查成，让用户过一会儿再点。
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * 版本与云更新面板。
 *
 * 打开就顺手问一下服务器：有没有新的 JS 包、有没有新的安装包。
 * 前者点了就能下、重启即生效；后者要过一遍系统安装器。
 */
export function UpdateSheet({ visible, onClose, onToast }: Props) {
  const insets = useSafeAreaInsets();
  const updatesState = Updates.useUpdates();

  // 异步流程里要读「此刻真实的下发状态」，闭包里的会是旧值
  const liveRef = useRef(updatesState);
  liveRef.current = updatesState;

  const [phase, setPhase] = useState<Phase>('idle');
  const [release, setRelease] = useState<ApkRelease | null>(null);
  const [apkProgress, setApkProgress] = useState(0);
  const [problem, setProblem] = useState('');
  const [needPermission, setNeedPermission] = useState(false);

  const running = runningInfo();

  const runCheck = async () => {
    setProblem('');
    setNeedPermission(false);
    if (!CAN_UPDATE) {
      setPhase('unsupported');
      return;
    }

    const live = liveRef.current;
    // 后台已经悄悄下好了：不用再问服务器，直接告诉用户重启就行
    if (live.isUpdatePending) {
      setPhase('otaReady');
      return;
    }
    // 正在后台下载：别插队（会一直等），把进度显示出来就好
    if (live.isDownloading) {
      setPhase('backgroundDownload');
      return;
    }

    setPhase('checking');
    const [ota, apk] = await Promise.all([
      withTimeout<CheckOutcome | { kind: 'slow' }>(checkOta(), CHECK_TIMEOUT_MS, { kind: 'slow' }),
      checkApk(),
    ]);

    if (apk && apk.available) {
      setRelease(apk);
      setPhase('apk');
      return;
    }
    if (ota.kind === 'ota') {
      setPhase('ota');
      return;
    }
    if (ota.kind === 'slow') {
      // 多半是正在后台下更新包占着队，也可能就是网太慢
      if (liveRef.current.isDownloading) {
        setPhase('backgroundDownload');
        return;
      }
      setProblem('更新服务器一直没回应，过一会儿再点一次试试');
      setPhase('problem');
      return;
    }
    if (ota.kind === 'error') {
      setProblem(ota.message);
      setPhase('problem');
      return;
    }
    setPhase('uptodate');
  };

  // 后台把新版下好了 → 立刻切成「重启即可」，别让用户在下载状态里干等
  useEffect(() => {
    if (!visible || !updatesState.isUpdatePending) return;
    setPhase((current) =>
      current === 'checking' || current === 'downloading' || current === 'backgroundDownload'
        ? 'otaReady'
        : current,
    );
  }, [visible, updatesState.isUpdatePending]);

  useEffect(() => {
    if (visible) {
      setRelease(null);
      setApkProgress(0);
      void runCheck();
    }
    // 只在打开面板时检查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleFetchOta = async () => {
    setPhase('downloading');
    const result = await fetchOta();
    if (result.ok) {
      setPhase('otaReady');
      return;
    }
    setProblem(result.message);
    setPhase('problem');
  };

  const handleRestart = async () => {
    onToast('正在换成新版本…');
    await restartIntoUpdate();
  };

  const handleInstallApk = async () => {
    if (!release) return;
    setApkProgress(0);
    setPhase('apkDownloading');
    const downloaded = await downloadApk(release, setApkProgress);
    if (!downloaded.ok) {
      setProblem(downloaded.message);
      setPhase('problem');
      return;
    }
    setPhase('installing');
    const installed = await installApk(downloaded.uri);
    if (installed.ok) {
      onToast('安装器已经打开，点「安装」就换新版了');
      setPhase('apk');
      return;
    }
    setNeedPermission(true);
    setProblem('系统拦住了安装。先允许本应用「安装未知应用」，再点一次下载安装。');
    setPhase('problem');
  };

  const otaProgress = updatesState.downloadProgress ?? 0;
  const otaDownloading = phase === 'downloading' && updatesState.isDownloading;
  // 后台自己在下的时候也要把进度显示出来（否则用户只会看到一直在转/什么都没有）
  const showOtaProgress = otaDownloading || phase === 'backgroundDownload';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>版本与云更新</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            改界面、改逻辑这种更新，手机直接下载就行，不用重新装；只有动到安卓原生部分，才需要装一次新的安装包。
            平时它会在后台自己把新版下好，下次打开就是新的，不用管这里。
          </Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>当前版本</Text>
              <Text style={styles.rowValue}>{running.version}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>正在运行</Text>
              <Text style={styles.rowValue}>
                {!CAN_UPDATE ? '电脑预览' : running.isEmbedded ? '安装包里自带的' : '下载来的更新包'}
              </Text>
            </View>
            {running.createdAt ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>这一版的时间</Text>
                <Text style={styles.rowValue}>
                  {running.createdAt.toLocaleString('zh-CN', { hour12: false })}
                </Text>
              </View>
            ) : null}
            {running.updateId ? (
              <Text style={styles.faint}>更新编号 {running.updateId.slice(0, 8)}</Text>
            ) : null}
            <Text style={styles.faint}>
              原生底座 {CAN_UPDATE ? running.runtimeVersion : '电脑预览'}（只有重新装安装包才会变）
            </Text>
          </View>

          <View style={[styles.status, toneOf(phase)]}>
            {phase === 'checking' || otaDownloading || phase === 'apkDownloading' || phase === 'installing' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name={iconOf(phase)} size={18} color={iconColorOf(phase)} />
            )}
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>{titleOf(phase)}</Text>
              <Text style={styles.statusHint}>{hintOf(phase, problem, release, otaProgress)}</Text>
            </View>
          </View>

          {phase === 'apkDownloading' || phase === 'installing' ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(apkProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {release ? `${formatSize(release.size)} · ` : ''}
                {Math.round(apkProgress * 100)}%
              </Text>
            </View>
          ) : null}

          {showOtaProgress ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(otaProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(otaProgress * 100)}%</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {phase === 'ota' ? (
              <PrimaryButton label="下载这个更新" icon="cloud-download-outline" onPress={() => void handleFetchOta()} />
            ) : null}

            {phase === 'otaReady' ? (
              <PrimaryButton label="马上重启，用上新版本" icon="refresh-outline" onPress={() => void handleRestart()} />
            ) : null}

            {phase === 'apk' && release ? (
              <PrimaryButton
                label={`下载并安装 v${release.version}`}
                icon="download-outline"
                onPress={() => void handleInstallApk()}
              />
            ) : null}

            {phase === 'problem' && needPermission ? (
              <PrimaryButton
                label="去允许安装未知应用"
                icon="settings-outline"
                onPress={() => void openInstallPermissionSettings()}
              />
            ) : null}

            {phase !== 'unsupported' &&
            phase !== 'checking' &&
            phase !== 'downloading' &&
            phase !== 'apkDownloading' &&
            phase !== 'installing' ? (
              <PrimaryButton
                label="再检查一次"
                variant="outline"
                icon="refresh-outline"
                onPress={() => void runCheck()}
                style={styles.secondary}
              />
            ) : null}
          </View>

          {release && release.notes && release.available ? (
            <Text style={styles.notes}>这一版改了什么：{release.notes}</Text>
          ) : null}

        </ScrollView>
      </View>
    </Modal>
  );
}

function toneOf(phase: Phase) {
  if (phase === 'problem') return styles.statusBad;
  if (phase === 'ota' || phase === 'otaReady' || phase === 'apk' || phase === 'uptodate') return styles.statusGood;
  return styles.statusPlain;
}

function iconOf(phase: Phase): keyof typeof Ionicons.glyphMap {
  switch (phase) {
    case 'ota':
    case 'apk':
      return 'cloud-download-outline';
    case 'backgroundDownload':
      return 'cloud-download-outline';
    case 'otaReady':
      return 'checkmark-circle-outline';
    case 'uptodate':
      return 'checkmark-circle-outline';
    case 'problem':
      return 'alert-circle-outline';
    default:
      return 'information-circle-outline';
  }
}

function iconColorOf(phase: Phase) {
  if (phase === 'problem') return colors.primary;
  if (phase === 'ota' || phase === 'apk' || phase === 'otaReady' || phase === 'uptodate') return colors.success;
  return colors.textSub;
}

function titleOf(phase: Phase) {
  switch (phase) {
    case 'unsupported':
      return '电脑预览里没有这一套';
    case 'checking':
      return '正在检查…';
    case 'ota':
      return '有新的更新包';
    case 'downloading':
      return '正在下载更新';
    case 'backgroundDownload':
      return '正在后台下载新版本';
    case 'otaReady':
      return '新版本已经下好了';
    case 'apk':
      return '要装一次新的安装包';
    case 'apkDownloading':
      return '正在下载安装包';
    case 'installing':
      return '正在打开安装器';
    case 'problem':
      return '这次没成功';
    case 'uptodate':
      return '已经是最新版';
    default:
      return '还没检查';
  }
}

function hintOf(phase: Phase, problem: string, release: ApkRelease | null, otaProgress: number) {
  switch (phase) {
    case 'unsupported':
      return '云更新只在装了安装包的手机上生效，手机上走「我的 → 版本与更新」';
    case 'checking':
      return '连到服务器上看一眼，几秒钟';
    case 'ota':
      return '改动只在界面和逻辑里，下载完重启一下就生效';
    case 'downloading':
      return otaProgress > 0 ? '下好会自动告诉你' : '正在下载，稍等一下';
    case 'backgroundDownload':
      return '它在自己下，不用等在这儿。手机切到别的应用时下载会暂停，回到这个 App 会接着下；下好以后下次打开就是新版';
    case 'otaReady':
      return '已经在后台下好了，重启一下就换成新版；收藏、记录这些都还在';
    case 'apk':
      return release
        ? `服务器上是 v${release.version}（${formatSize(release.size)}），这一版动了安卓原生部分，得装一次安装包`
        : '';
    case 'apkDownloading':
      return '下载完会弹出系统的安装界面';
    case 'installing':
      return '在系统的安装界面点「安装」，装完就换新版了';
    case 'problem':
      return problem;
    case 'uptodate':
      return '服务器上没有更新的版本';
    default:
      return '点下面的按钮检查一下';
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  body: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.lg,
  },
  intro: {
    ...typography.caption,
    color: colors.textSub,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textSub,
  },
  rowValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  faint: {
    ...typography.caption,
    color: colors.textFaint,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  statusPlain: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  statusGood: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  statusBad: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  statusText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  statusHint: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 4,
    lineHeight: 18,
  },
  progressWrap: {
    marginTop: spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    ...typography.caption,
    color: colors.textSub,
    marginTop: 6,
    textAlign: 'right',
  },
  actions: {
    marginTop: spacing.xl,
  },
  secondary: {
    marginTop: spacing.md,
    height: 46,
  },
  notes: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
});
