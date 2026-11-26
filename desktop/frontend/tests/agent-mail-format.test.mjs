import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAgentReplySubject,
  formatAgentMailTime,
  parseMailAddressDisplay,
  resolveConciseAgentTitle,
} from "../src/utils/agentMailFormat.ts";

test("parseMailAddressDisplay 准确拆解带尖括号显示名、纯邮箱与空字符串", () => {
  assert.deepEqual(
    parseMailAddressDisplay("pifz6658 <pifz6658@agent.qq.com>"),
    {
      name: "pifz6658",
      email: "pifz6658@agent.qq.com",
    },
  );

  assert.deepEqual(
    parseMailAddressDisplay("Agent Mail 团队 <admin@agent.qq.com>"),
    {
      name: "Agent Mail 团队",
      email: "admin@agent.qq.com",
    },
  );

  assert.deepEqual(parseMailAddressDisplay("pifz6658@agent.qq.com"), {
    name: "pifz6658",
    email: "pifz6658@agent.qq.com",
  });

  assert.deepEqual(
    parseMailAddressDisplay("pifz6658@agent.qq.com <pifz6658@agent.qq.com>"),
    {
      name: "pifz6658",
      email: "pifz6658@agent.qq.com",
    },
  );

  assert.deepEqual(parseMailAddressDisplay("   "), { name: "", email: "" });
});

test("formatAgentMailTime 将 ISO-8601 时间字符串格式化为列表与详情可读时间，不裸露 T...Z", () => {
  const isoToday = "2026-11-26T08:51:23Z";
  const parsedToday = new Date(isoToday);
  const nowSameDay = new Date(
    parsedToday.getFullYear(),
    parsedToday.getMonth(),
    parsedToday.getDate(),
    23,
    30,
    0,
  );

  const zhListToday = formatAgentMailTime(
    isoToday,
    "zh-CN",
    "list",
    nowSameDay,
  );
  assert.doesNotMatch(zhListToday, /T.*Z/);
  assert.match(zhListToday, /^今天 \d{2}:\d{2}$/);

  const enListToday = formatAgentMailTime(
    isoToday,
    "en-US",
    "list",
    nowSameDay,
  );
  assert.match(enListToday, /^Today \d{2}:\d{2}$/);

  const zhDetail = formatAgentMailTime(isoToday, "zh-CN", "detail", nowSameDay);
  assert.doesNotMatch(zhDetail, /T.*Z/);
  assert.match(zhDetail, /^\d{1,2} 月 \d{1,2} 日 \d{2}:\d{2}$/);

  const enDetail = formatAgentMailTime(isoToday, "en-US", "detail", nowSameDay);
  assert.match(enDetail, /^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2}$/);

  const nowNextDay = new Date(nowSameDay);
  nowNextDay.setDate(nowSameDay.getDate() + 1);
  assert.equal(
    formatAgentMailTime(isoToday, "zh-CN", "list", nowNextDay),
    "昨天",
  );
  assert.equal(
    formatAgentMailTime(isoToday, "en-US", "list", nowNextDay),
    "Yesterday",
  );

  const isoEarlierSameYear = new Date(
    nowSameDay.getFullYear(),
    10,
    12,
    9,
    15,
    0,
  ).toISOString();
  assert.equal(
    formatAgentMailTime(isoEarlierSameYear, "zh-CN", "list", nowSameDay),
    "11-12",
  );

  const isoPrevYear = new Date(
    nowSameDay.getFullYear() - 1,
    4,
    6,
    10,
    0,
    0,
  ).toISOString();
  assert.equal(
    formatAgentMailTime(isoPrevYear, "zh-CN", "list", nowSameDay),
    `${nowSameDay.getFullYear() - 1}-05-06`,
  );
  assert.equal(formatAgentMailTime("", "zh-CN", "list", nowSameDay), "");
});

test("精简智能体邮箱标题与常规邮箱回信主题构造", () => {
  assert.equal(
    resolveConciseAgentTitle("WorkBuddy 智能体邮箱", "workbuddy"),
    "WorkBuddy",
  );
  assert.equal(
    resolveConciseAgentTitle("WorkBuddy Agent Mail", "workbuddy"),
    "WorkBuddy",
  );
  assert.equal(
    resolveConciseAgentTitle("研发自动化 Agent", "workbuddy"),
    "研发自动化 Agent",
  );
  assert.equal(resolveConciseAgentTitle("Muse Mail", "muse"), "Muse");

  assert.equal(buildAgentReplySubject("发版提醒"), "Re: 发版提醒");
  assert.equal(buildAgentReplySubject("re: 发版提醒"), "Re: 发版提醒");
});
