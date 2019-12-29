import React from 'react';
import './Loading.css';

interface IProps {
	size?: string;
}

const Loading = (props: IProps) => (
	<div className="spinner-border" style={{ width: props.size, height: props.size }} role="status">
		<span className="sr-only">Loading...</span>
	</div>
);
export default Loading;
