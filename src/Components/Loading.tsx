import React from 'react';
import './Loading.css';

interface IProps {
	size?: string;
}

const Loading = (props: IProps) => (
	<i className="fa fa-spinner Loading-rotateRight" style={{ fontSize: props.size }}/>
);
export default Loading;
