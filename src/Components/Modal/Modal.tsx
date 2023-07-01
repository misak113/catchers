import classNames from 'classnames';
import React from 'react';
import './Modal.css';

interface IModelProps {
	title: string;
	children?: React.ReactNode;
	open: boolean;
	setOpen: (open: boolean) => void;
}

export const Modal = ({ open, setOpen, title, children }: IModelProps) => {
	return (
		<>
			<div className={classNames("Modal modal fade", { show: open })} tabIndex={-1}>
				<div className="modal-dialog">
					<div className="modal-content">
						<div className="modal-header">
							<h5 className="modal-title">{title}</h5>
							<button type="button" className="close" onClick={() => setOpen(false)}>
								<span>&times;</span>
							</button>
						</div>
						<div className="modal-body">
							{children}
						</div>
						<div className="modal-footer">
							<button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			</div>

			<div className={classNames("Modal modal-backdrop fade", { show: open })}></div>
		</>
	);
};
