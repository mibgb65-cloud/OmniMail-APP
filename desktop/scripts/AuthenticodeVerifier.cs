using System;
using System.Runtime.InteropServices;

namespace OmniMail
{
    // 使用 Windows 原生 Authenticode 策略；不修改证书信任，不按本地化错误文案放宽判断。
    public static class ReleaseAuthenticode
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct FileInfo
        {
            public uint Size;
            [MarshalAs(UnmanagedType.LPWStr)] public string Path;
            public IntPtr File;
            public IntPtr KnownSubject;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct TrustData
        {
            public uint Size;
            public IntPtr PolicyCallbackData;
            public IntPtr SipClientData;
            public uint UiChoice;
            public uint RevocationChecks;
            public uint UnionChoice;
            public IntPtr FileInfo;
            public uint StateAction;
            public IntPtr StateData;
            [MarshalAs(UnmanagedType.LPWStr)] public string UrlReference;
            public uint ProviderFlags;
            public uint UiContext;
            public IntPtr SignatureSettings;
        }

        [DllImport("wintrust.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
        private static extern uint WinVerifyTrust(IntPtr window, ref Guid action, ref TrustData data);

        public static uint Verify(string path)
        {
            FileInfo file = new FileInfo();
            file.Size = (uint)Marshal.SizeOf(typeof(FileInfo));
            file.Path = path;
            IntPtr pointer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(FileInfo)));
            Marshal.StructureToPtr(file, pointer, false);
            TrustData data = new TrustData();
            data.Size = (uint)Marshal.SizeOf(typeof(TrustData));
            data.UiChoice = 2; // WTD_UI_NONE：验证不能弹出证书导入或自动信任提示。
            data.UnionChoice = 1; // WTD_CHOICE_FILE
            data.FileInfo = pointer;
            data.StateAction = 1; // WTD_STATEACTION_VERIFY
            Guid action = new Guid("00AAC56B-CD44-11D0-8CC2-00C04FC295EE");
            try
            {
                return WinVerifyTrust(IntPtr.Zero, ref action, ref data);
            }
            finally
            {
                data.StateAction = 2; // WTD_STATEACTION_CLOSE
                WinVerifyTrust(IntPtr.Zero, ref action, ref data);
                Marshal.DestroyStructure(pointer, typeof(FileInfo));
                Marshal.FreeHGlobal(pointer);
            }
        }
    }
}
