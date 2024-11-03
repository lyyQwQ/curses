import { ServiceNetworkState } from "@/types";
import classNames from "classnames";
import { FC } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  showError?: boolean;
  errorLabel?: string;
  stopLabel?: string;
  startLabel?: string;
  status: ServiceNetworkState;
  onStart: () => void;
  onStop: () => void;
  onPending?: () => void;
  onError?: () => void;
}

const ServiceButton: FC<Props> = ({
  showError,
  errorLabel,
  stopLabel,
  startLabel,
  status,
  onStart,
  onStop,
  onPending,
  onError,
}) => {
  const { t } = useTranslation();
  console.info('ServiceButton rendered with status:', status);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.info('Service button clicked, status:', status);
    console.info('Button props:', { showError, errorLabel, stopLabel, startLabel });
    
    switch (status) {
      case ServiceNetworkState.disconnected:
        console.info('Calling onStart');
        onStart();
        break;
      case ServiceNetworkState.connected:
        console.info('Calling onStop');
        onStop();
        break;
      case ServiceNetworkState.connecting:
        console.info('Calling onPending');
        onPending?.();
        break;
      case ServiceNetworkState.error:
        console.info('Calling onError');
        onError?.();
        break;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={classNames("btn btn-sm", {
        "btn-primary": status === ServiceNetworkState.disconnected,
        "btn-error": status === ServiceNetworkState.error && showError,
        "btn-neutral": status === ServiceNetworkState.connected,
        loading: status === ServiceNetworkState.connecting,
      })}
    >
      {status === ServiceNetworkState.connected && (stopLabel || t('common.btn_disconnect'))}
      {status === ServiceNetworkState.disconnected && (startLabel || t('common.btn_connect'))}
      {status === ServiceNetworkState.connecting && t('common.btn_connecting')}
      {status === ServiceNetworkState.error && (errorLabel || t('common.btn_error'))}
    </button>
  );
};

export default ServiceButton;
