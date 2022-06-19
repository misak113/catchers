import React from 'react';
import moment from 'moment';

interface IProps {
	startsAt: Date;
}

function FormattedDateTime(props: IProps) {
	return <>
		{moment(props.startsAt).format('LL')} <small>{moment(props.startsAt).format('ddd')}</small>, {moment(props.startsAt).format('LT')}
	</>;
}
export default FormattedDateTime;
