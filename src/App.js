import React from "react";
import ImageGallery from "./components/ImageGallery";
import "./App.css";

const PREFIX_URL = "./static/";

console.log("Hai");
class App extends React.Component {
	constructor() {
		super();
		this.state = {
			thumbnailPosition: "bottom",
		};
		this.images = [
			{
				original: `${PREFIX_URL}1.jpg`,
				thumbnail: `${PREFIX_URL}1t.jpg`,
				originalClass: "featured-slide",
				thumbnailClass: "featured-thumb",
				description: "",
			},
		].concat(this._getStaticImages());
	}

	_onImageClick(event) {
		console.debug(
			"clicked on image",
			event.target,
			"at index",
			this._imageGallery.getCurrentIndex()
		);
	}

	_onImageLoad(event) {
		console.debug("loaded image", event.target.src);
	}

	_onSlide(index) {
		console.debug('slide to index', index);
	}

	_onScreenChange(fullScreenElement) {
		console.debug("isFullScreen?", !!fullScreenElement);
	}
	_getStaticImages() {
		let images = [];
		for (let i = 2; i < 9; i++) {
			images.push({
				original: `${PREFIX_URL}${i}.jpg`,
				thumbnail: `${PREFIX_URL}${i}t.jpg`,
			});
		}
		console.log(images);
		return images;
	}

	render() {
		return (
			<section className="app">
				<ImageGallery
					ref={(i) => (this._imageGallery = i)}
					items={this.images}
					onClick={this._onImageClick.bind(this)}
					onImageLoad={this._onImageLoad}
					onSlide={this._onSlide.bind(this)}
					onScreenChange={this._onScreenChange.bind(this)}
					showBullets={true}
					showThumbnails={true}
					showNav={true}
					thumbnailPosition={this.state.thumbnailPosition}
					slideOnThumbnailOver={false}
					swipeable={true}
				/>
			</section>
		);
	}
}
console.log("Hai 2");
export default App;
