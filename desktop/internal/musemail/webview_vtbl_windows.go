//go:build windows

package musemail

import "golang.org/x/sys/windows"

var iidICoreWebView2_2 = windows.GUID{
	Data1: 0x9e8f0cf8,
	Data2: 0xe670,
	Data3: 0x4b5e,
	Data4: [8]byte{0xb2, 0xbc, 0x73, 0xe0, 0x61, 0xe3, 0x18, 0x4c},
}

var iidICoreWebView2Controller2 = windows.GUID{
	Data1: 0xc979903e,
	Data2: 0xd4ca,
	Data3: 0x4228,
	Data4: [8]byte{0x92, 0xeb, 0x47, 0xee, 0x3f, 0xa9, 0x6e, 0xab},
}

type w2Color struct {
	A, R, G, B uint8
}

type iUnknownVtbl struct {
	QueryInterface, AddRef, Release uintptr
}

type w2EnvironmentVtbl struct {
	iUnknownVtbl
	CreateCoreWebView2Controller, CreateWebResourceResponse         uintptr
	GetBrowserVersionString                                         uintptr
	AddNewBrowserVersionAvailable, RemoveNewBrowserVersionAvailable uintptr
}

type w2Environment struct{ vtbl *w2EnvironmentVtbl }

type w2ControllerVtbl struct {
	iUnknownVtbl
	GetIsVisible, PutIsVisible                            uintptr
	GetBounds, PutBounds                                  uintptr
	GetZoomFactor, PutZoomFactor                          uintptr
	AddZoomFactorChanged, RemoveZoomFactorChanged         uintptr
	SetBoundsAndZoomFactor, MoveFocus                     uintptr
	AddMoveFocusRequested, RemoveMoveFocusRequested       uintptr
	AddGotFocus, RemoveGotFocus                           uintptr
	AddLostFocus, RemoveLostFocus                         uintptr
	AddAcceleratorKeyPressed, RemoveAcceleratorKeyPressed uintptr
	GetParentWindow, PutParentWindow                      uintptr
	NotifyParentWindowPositionChanged                     uintptr
	Close, GetCoreWebView2                                uintptr
}

type w2Controller struct{ vtbl *w2ControllerVtbl }

type w2Controller2Vtbl struct {
	w2ControllerVtbl
	GetDefaultBackgroundColor, PutDefaultBackgroundColor uintptr
}

type w2Controller2 struct{ vtbl *w2Controller2Vtbl }

// w2WebViewVtbl 严格对齐 ICoreWebView2 全部 61 个槽位（slot 0..60）。
type w2WebViewVtbl struct {
	iUnknownVtbl
	GetSettings, GetSource, Navigate, NavigateToString                          uintptr
	AddNavigationStarting, RemoveNavigationStarting                             uintptr
	AddContentLoading, RemoveContentLoading                                     uintptr
	AddSourceChanged, RemoveSourceChanged                                       uintptr
	AddHistoryChanged, RemoveHistoryChanged                                     uintptr
	AddNavigationCompleted, RemoveNavigationCompleted                           uintptr
	AddFrameNavigationStarting, RemoveFrameNavigationStarting                   uintptr
	AddFrameNavigationCompleted, RemoveFrameNavigationCompleted                 uintptr
	AddScriptDialogOpening, RemoveScriptDialogOpening                           uintptr
	AddPermissionRequested, RemovePermissionRequested                           uintptr
	AddProcessFailed, RemoveProcessFailed                                       uintptr
	AddScriptToExecuteOnDocumentCreated, RemoveScriptToExecuteOnDocumentCreated uintptr
	ExecuteScript, CapturePreview, Reload                                       uintptr
	PostWebMessageAsJson, PostWebMessageAsString                                uintptr
	AddWebMessageReceived, RemoveWebMessageReceived                             uintptr
	CallDevToolsProtocolMethod, GetBrowserProcessId                             uintptr
	GetCanGoBack, GetCanGoForward, GoBack, GoForward                            uintptr
	GetDevToolsProtocolEventReceiver, Stop                                      uintptr
	AddNewWindowRequested, RemoveNewWindowRequested                             uintptr
	AddDocumentTitleChanged, RemoveDocumentTitleChanged                         uintptr
	GetDocumentTitle                                                            uintptr
	AddHostObjectToScript, RemoveHostObjectFromScript                           uintptr
	OpenDevToolsWindow                                                          uintptr
	AddContainsFullScreenElementChanged, RemoveContainsFullScreenElementChanged uintptr
	GetContainsFullScreenElement                                                uintptr
	AddWebResourceRequested, RemoveWebResourceRequested                         uintptr
	AddWebResourceRequestedFilter, RemoveWebResourceRequestedFilter             uintptr
	AddWindowCloseRequested, RemoveWindowCloseRequested                         uintptr
}

type w2WebView struct{ vtbl *w2WebViewVtbl }

// w2WebView2Vtbl 嵌入完整 w2WebViewVtbl，确保 GetCookieManager 位于 slot 66、GetEnvironment 位于 slot 67。
type w2WebView2Vtbl struct {
	w2WebViewVtbl
	AddWebResourceResponseReceived, RemoveWebResourceResponseReceived uintptr
	NavigateWithWebResourceRequest                                    uintptr
	AddDOMContentLoaded, RemoveDOMContentLoaded                       uintptr
	GetCookieManager, GetEnvironment                                  uintptr
}

type w2WebView2 struct{ vtbl *w2WebView2Vtbl }

type w2SettingsVtbl struct {
	iUnknownVtbl
	GetIsScriptEnabled, PutIsScriptEnabled                               uintptr
	GetIsWebMessageEnabled, PutIsWebMessageEnabled                       uintptr
	GetAreDefaultScriptDialogsEnabled, PutAreDefaultScriptDialogsEnabled uintptr
	GetIsStatusBarEnabled, PutIsStatusBarEnabled                         uintptr
	GetAreDevToolsEnabled, PutAreDevToolsEnabled                         uintptr
	GetAreDefaultContextMenusEnabled, PutAreDefaultContextMenusEnabled   uintptr
	GetAreHostObjectsAllowed, PutAreHostObjectsAllowed                   uintptr
	GetIsZoomControlEnabled, PutIsZoomControlEnabled                     uintptr
	GetIsBuiltInErrorPageEnabled, PutIsBuiltInErrorPageEnabled           uintptr
}

type w2Settings struct{ vtbl *w2SettingsVtbl }

type w2CookieMgrVtbl struct {
	iUnknownVtbl
	CreateCookie, CopyCookie, GetCookies, AddOrUpdateCookie uintptr
	DeleteCookie, DeleteCookies                             uintptr
	DeleteCookiesWithDomainAndPath, DeleteAllCookies        uintptr
}

type w2CookieMgr struct{ vtbl *w2CookieMgrVtbl }

type w2CookieListVtbl struct {
	iUnknownVtbl
	GetCount, GetValueAtIndex uintptr
}

type w2CookieList struct{ vtbl *w2CookieListVtbl }

type w2CookieVtbl struct {
	iUnknownVtbl
	GetName, GetValue, PutValue, GetDomain, GetPath uintptr
	GetExpires, PutExpires                          uintptr
	GetIsHttpOnly, PutIsHttpOnly                    uintptr
	GetSameSite, PutSameSite                        uintptr
	GetIsSecure, PutIsSecure, GetIsSession          uintptr
}

type w2Cookie struct{ vtbl *w2CookieVtbl }

type w2NavArgsVtbl struct {
	iUnknownVtbl
	GetUri, GetIsUserInitiated, GetIsRedirected uintptr
	GetRequestHeaders, GetCancel, PutCancel     uintptr
}

type w2NavArgs struct{ vtbl *w2NavArgsVtbl }

type w2NewWinArgsVtbl struct {
	iUnknownVtbl
	GetUri, PutNewWindow, GetNewWindow, PutHandled uintptr
}

type w2NewWinArgs struct{ vtbl *w2NewWinArgsVtbl }
