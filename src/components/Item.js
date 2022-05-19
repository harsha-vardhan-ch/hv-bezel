import React from "react";
import { bool, string } from "prop-types";
import Magnifier from "react-magnifier";
import "../styles/imageGallery.scss";

const Item = React.memo(
	({
		fullscreen, // fullscreen version of img
		isFullscreen,
		original,
	}) => {
		const itemSrc = isFullscreen ? fullscreen || original : original;
		return (
			<Magnifier
				className="hv-point"
				src={itemSrc}
				width="100%"
				height="80%"
				mgWidth={200}
				mgHeight={200}
			/>
		);
	}
);

Item.propTypes = {
	fullscreen: string, // fullscreen version of img
	isFullscreen: bool,
	original: string.isRequired,
};

export default Item;
