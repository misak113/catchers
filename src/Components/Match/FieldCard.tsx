import React from 'react';
import Loading from '../Loading';

interface IProps {
	field: string | undefined;
}

function FieldCard(props: IProps) {
	return (
		<div className="card">
			<div className="card-header">
				Hřiště
			</div>
			<div className="card-body">
				{props.field
				? <blockquote className="blockquote mb-0">
					<p>{props.field}</p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default FieldCard;
