import React from "react";
import { bool, string } from "prop-types";
import Magnifier from "react-magnifier";
import "../styles/imageGallery.scss";

// Packages for swiper package 

// import SwiperCore, { Navigation, Pagination } from "swiper";
// import { Swiper, SwiperSlide } from "swiper/react";
// import "swiper/swiper-bundle.min.css";
// import "swiper/swiper.min.css";
// SwiperCore.use([Navigation, Pagination]);

const Item = React.memo(
	({
		fullscreen, // fullscreen version of img
		isFullscreen,
		original,
	}) => {
		const itemSrc = isFullscreen ? fullscreen || original : original;
		return (

			// Tried to implement image swipe functionality with image zoom using swiper package 

			// <React.Fragment>
			// 	<Swiper
			// 		navigation={true}
			// 		modules={[Pagination, Navigation]}
			// 		className="mySwiper"
			// 	>
			// 		<SwiperSlide>
			// 			<Magnifier
			// 				className="hv-point"
			// 				src={itemSrc}
			// 				width="100%"
			// 				height="80%"
			// 				mgWidth={200}
			// 				mgHeight={200}
			// 			/>
			// 		</SwiperSlide>
			// 	</Swiper>
			// </React.Fragment>

			// Implemented it seperately without zoom functionality. Link to the repository https://github.com/harsha-vardhan-ch/bezel-hv2
			

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
