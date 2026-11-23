export function mailAiScope(includesSubject: boolean) {
  const mailContent = includesSubject ? "当前邮件主题与正文" : "当前邮件正文";
  return {
    short: `${mailContent} · 附件不外传`,
    mailContent,
    notShared: "邮件头、附件文件、文件名及附件内容预览",
  };
}
