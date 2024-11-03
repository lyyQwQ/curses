import { Body } from "@tauri-apps/api/http";
import { getQueryData } from ".";
import { LIVE_URL_PREFIX } from "../constants";
import { LOGIN_INFO } from "../schema";
import type { SendMessage } from "../types";

// 获取直播分类
const getLiveCategoryApi = async () =>
  await getQueryData(
    `${LIVE_URL_PREFIX}/xlive/web-interface/v1/index/getWebAreaList`,
    {
      query: { source_id: "2" }
    }
  );

// 获取当前直播状态
const getLiveStatusApi = async (room_ids: string) =>
  await getQueryData(
    `${LIVE_URL_PREFIX}/xlive/web-room/v1/index/getRoomBaseInfo`,
    {
      query: { room_ids, req_biz: "link-center" }
    }
  );

// 获取身份码
const getLiveCodeApi = async () => {
  const state = window.ApiServer.state.services.bilibili.data;
  return await getQueryData(
    `${LIVE_URL_PREFIX}/xlive/open-platform/v1/common/operationOnBroadcastCode`,
    {
      method: "POST",
      body: Body.form({
        action: "1",
        csrf_token: state[LOGIN_INFO.csrf],
        csrf: state[LOGIN_INFO.csrf]
      }),
      headers: { cookie: state[LOGIN_INFO.cookie] }
    }
  );
}

// 获取ws认证token
const getLiveTokenApi = async (roomid: string) => {
  const state = window.ApiServer.state.services.bilibili.data;
  return await getQueryData(
    `${LIVE_URL_PREFIX}/xlive/web-room/v1/index/getDanmuInfo`,
    {
      query: {
        id: roomid,
      },
      headers:{
        cookie: state[LOGIN_INFO.cookie]
      },
      hideLoadingBar: true
    }
  );
}

// 获取礼物列表
const getGiftApi = async () => {
  const result = await getQueryData(
    `${LIVE_URL_PREFIX}/xlive/web-room/v1/giftPanel/giftConfig`,
    {
      query: {
        platform: "pc",
        room_id: "",
        area_parent_id: 11,
        area_id: 372
      }
    }
  );

  if (result) {
    const styleElement = document.createElement("style");
    // 礼物列表
    const giftList = result.data.list.map(
      ({ id, gif }: any) => `.gift-${id} { background-image: url(${gif}) } `
    );
    // 背景图片列表
    const backgroundImageList = result.data.combo_resources.map(
      ({ img_four }: any, index: number) =>
        `.background-image-${index} { background-image: url(${img_four}) } `
    );

    styleElement.innerHTML = [...giftList, ...backgroundImageList].join("");
    document.head.appendChild(styleElement);
    return backgroundImageList.length;
  }
};

// 获取表情列表
const getEmojiApi = async (roomid: string) => {
  const state = window.ApiServer.state.services.bilibili.data;
  return await getQueryData(
    `${LIVE_URL_PREFIX}/xlive/web-ucenter/v2/emoticon/GetEmoticons`,
    {
      query: {
        platform: "pc",
        room_id: roomid
      },
      headers: {
        cookie: state[LOGIN_INFO.cookie]
      },
      hideLoadingBar: true
    }
  );
}

// 发送消息
const sendMessageApi = async (message: SendMessage) => {
  const state = window.ApiServer.state.services.bilibili.data;
  return await getQueryData(`${LIVE_URL_PREFIX}/msg/send`, {
    method: "POST",
    body: Body.form({
      ...message,
      isInitiative: "",
      bubble: "0",
      color: "16777215",
      mode: "1",
      fontsize: "25",
      rnd: Math.floor(Date.now() / 1000).toString(),
      csrf: state[LOGIN_INFO.csrf],
      csrf_token: state[LOGIN_INFO.csrf]
    }),
    headers: {
      cookie: state[LOGIN_INFO.cookie]
    },
    hideLoadingBar: true
  });
};

export {
  getLiveCategoryApi,
  getLiveStatusApi,
  getLiveCodeApi,
  getGiftApi,
  getEmojiApi,
  sendMessageApi,
  getLiveTokenApi
};
