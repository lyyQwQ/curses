import { fetch, ResponseType } from "@tauri-apps/api/http";
import type { FetchOptions } from "@tauri-apps/api/http";
import type { Rewrite } from "../types";
import { toast } from "react-toastify";
import type { BilibiliResponse } from "../types";

// 请求总入口
const getQueryData = async (
  url: string,
  options: Rewrite<
    Partial<FetchOptions>,
    {
      returnError?: boolean;
      hideLoadingBar?: boolean;
    }
  >
) => {
  console.info('Making request to:', url);
  console.info('Request options:', options);
  
  const { method, returnError, headers, hideLoadingBar } = options;
  try {
    if(!hideLoadingBar) {
      // 如果需要显示加载状态,可以使用项目原有的loading组件
    }

    const response = await fetch(url, {
      ...options,
      method: method || "GET",
      timeout: 1000 * 60,
      headers: {
        ...headers,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
      },
      responseType: ResponseType.JSON
    });

    console.info('Response received:', response);

    const biliResponse = response.data as BilibiliResponse;
    console.info('Parsed bilibili response:', biliResponse);

    if (returnError || biliResponse?.code === 0 || biliResponse?.code === 200) {
      return biliResponse?.data ?? biliResponse;
    } else {
      throw biliResponse?.message || biliResponse?.msg || "请求出错，再试试吧~";
    }
  } catch (error: any) {
    console.error('Request failed:', error);
    console.error('Error stack:', error?.stack);
    toast.error('请求失败');

    // 处理Tauri HTTP错误
    if(error.includes && error.includes('not enable')) {
      toast.error('HTTP API未启用，请检查Tauri配置');
      return;
    }

    let errorMessage = error;

    if (error.includes("timed out")) {
      errorMessage = "服务器请求超时";
    } else if (error.includes("50")) {
      errorMessage = "服务器连接失败";
    }

    // 使用react-toastify显示错误信息
    toast.error(errorMessage);
  } finally {
    if(!hideLoadingBar) {
      // 如果需要隐藏加载状态
    }
  }
};

export { getQueryData };

export * from "./bilibili";
export * from "./live";
export * from "./chatGTP";
