package main

import "context"

func startSystemToastQueue() (func(string, string), context.CancelFunc) {
	ctx, stop := context.WithCancel(context.Background())
	messages := make(chan [2]string, 16)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-messages:
				if ctx.Err() == nil {
					_ = showPrivacySystemToast(ctx, msg[0], msg[1])
				}
			}
		}
	}()
	return func(title, subtitle string) {
		// 通知是尽力交付；系统繁忙时不阻塞邮件入库或堆积无限的通知进程。
		select {
		case messages <- [2]string{title, subtitle}:
		default:
		}
	}, stop
}
