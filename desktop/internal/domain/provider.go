package domain

type EndpointPreset struct {
	Protocol Protocol `json:"protocol"`
	Host     string   `json:"host"`
	Port     int      `json:"port"`
	TLSMode  TLSMode  `json:"tlsMode"`
}

type ProviderPreset struct {
	Code      string           `json:"code"`
	Name      string           `json:"name"`
	AuthKinds []AuthKind       `json:"authKinds"`
	Endpoints []EndpointPreset `json:"endpoints"`
}

// ProviderPresets 是新增服务商的单一入口。每次返回独立配置，调用方不能改写其他账号的默认值。
// 这些参数只用于填充向导；连通性、服务商授权政策与用户认证必须另外校验。
func ProviderPresets() []ProviderPreset {
	return []ProviderPreset{
		newPreset("gmail", "Gmail", "imap.gmail.com", "smtp.gmail.com", AuthOAuth2, AuthPassword),
		newPreset("qq", "QQ 邮箱", "imap.qq.com", "smtp.qq.com", AuthPassword),
		newPreset("netease_163", "网易 163", "imap.163.com", "smtp.163.com", AuthPassword),
		newPreset("netease_126", "网易 126", "imap.126.com", "smtp.126.com", AuthPassword),
		newPreset("linuxdo", "LINUX DO Mail", "mail.linux.do", "mail.linux.do", AuthPassword),
		newPreset("custom", "自定义 IMAP/SMTP", "", "", AuthPassword, AuthOAuth2),
	}
}

func FindProviderPreset(code string) (ProviderPreset, bool) {
	for _, preset := range ProviderPresets() {
		if preset.Code == code {
			return preset, true
		}
	}
	return ProviderPreset{}, false
}

func newPreset(code, name, imap, smtp string, auth ...AuthKind) ProviderPreset {
	return ProviderPreset{
		Code: code, Name: name, AuthKinds: auth,
		Endpoints: []EndpointPreset{
			{Protocol: ProtocolIMAP, Host: imap, Port: 993, TLSMode: TLSImplicit},
			{Protocol: ProtocolSMTP, Host: smtp, Port: 465, TLSMode: TLSImplicit},
		},
	}
}
