import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { formatCurrencyAmount, formatCurrencyAmountHumanized } from '../../Util/currency';
import { DEFAULT_CURRENCY_CODE } from '../../Model/settleUpFacade';
import QRCode from 'react-qr-code';
import qrcode from 'qrcode';
import qrIcon from './qr.png';
import './QRModal.css';

interface IQRModalProps {
	sepaQrCode: string;
	amount: string;
	bankAccount: string;
	currencyCode: string;
}

const QRModal = ({ sepaQrCode, amount, bankAccount, currencyCode }: IQRModalProps) => {
	const [open, setOpen] = useState(false);

	const downloadQRCode = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		const link = document.createElement("a");
		const qrCodeDataUrl = await qrcode.toDataURL(sepaQrCode);
		link.href = qrCodeDataUrl;
		link.download = `qr-${formatCurrencyAmount({ amount })}-${DEFAULT_CURRENCY_CODE}-${bankAccount}.png`;
		link.click();
	}, [amount, bankAccount, sepaQrCode]);

	return (
		<span className="QR">
			<button type="button" className="btn btn-light" onClick={() => setOpen(!open)}>
				<img className="qr-icon" src={qrIcon} alt='QR kód'/>
			</button>

			<div className={classNames("QRModal modal fade", { show: open })} tabIndex={-1}>
				<div className="modal-dialog">
					<div className="modal-content">
						<div className="modal-header">
							<h5 className="modal-title">QR platba</h5>
							<button type="button" className="close" onClick={() => setOpen(false)}>
								<span>&times;</span>
							</button>
						</div>
						<div className="modal-body">
							<button className="qr-code btn btn-link" onClick={downloadQRCode}>
								<QRCode value={sepaQrCode} size={256} />
							</button>
							<h4><small>Částka:</small> {formatCurrencyAmountHumanized({ amount, currencyCode, decimals: 2 })}</h4>
							<h4><small>Číslo účtu:</small> {bankAccount}</h4>
						</div>
						<div className="modal-footer">
							<button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			</div>

			<div className={classNames("QRModal modal-backdrop fade", { show: open })}></div>
		</span>
	);
};
export default QRModal;
