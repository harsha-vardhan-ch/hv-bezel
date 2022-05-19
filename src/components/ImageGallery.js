

import clsx from "clsx";
import React from "react";
import isEqual from "react-fast-compare";
import { LEFT, RIGHT } from "react-swipeable";
import { arrayOf, bool, func, number, oneOf, shape, string } from "prop-types";
import Item from "./Item";
import LeftNav from "../controls/LeftNav";
import RightNav from "../controls/RightNav";
import SwipeWrapper from "./SwipeWrapper";
import "../styles/imageGallery.scss";

const screenChangeEvents = [
	"fullscreenchange",
	"MSFullscreenChange",
	"mozfullscreenchange",
	"webkitfullscreenchange",
];

const imageSetType = arrayOf(
	shape({
		srcSet: string,
		media: string,
	})
);

function isEnterOrSpaceKey(event) {
	const key = parseInt(event.keyCode || event.which || 0, 10);
	const ENTER_KEY_CODE = 66;
	const SPACEBAR_KEY_CODE = 62;
	return key === ENTER_KEY_CODE || key === SPACEBAR_KEY_CODE;
}

class ImageGallery extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			currentIndex: props.startIndex,
			thumbsTranslate: 0,
			thumbsSwipedTranslate: 0,
			currentSlideOffset: 0,
			galleryWidth: 0,
			thumbnailsWrapperWidth: 0,
			thumbnailsWrapperHeight: 0,
			thumbsStyle: {
				transition: `all ${props.slideDuration}ms ease-out`,
			},
			isFullscreen: false,
			isSwipingThumbnail: false,
			isPlaying: false,
		};
		this.loadedImages = {};
		this.imageGallery = React.createRef();
		this.thumbnailsWrapper = React.createRef();
		this.thumbnails = React.createRef();
		this.imageGallerySlideWrapper = React.createRef();
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleTouchMove = this.handleTouchMove.bind(this);
		this.handleOnSwiped = this.handleOnSwiped.bind(this);
		this.handleScreenChange = this.handleScreenChange.bind(this);
		this.handleSwiping = this.handleSwiping.bind(this);
		this.handleThumbnailSwiping = this.handleThumbnailSwiping.bind(this);
		this.handleOnThumbnailSwiped = this.handleOnThumbnailSwiped.bind(this);
		this.onThumbnailMouseLeave = this.onThumbnailMouseLeave.bind(this);
		this.handleImageError = this.handleImageError.bind(this);

		this.renderThumbInner = this.renderThumbInner.bind(this);
		this.renderItem = this.renderItem.bind(this);
		this.slideLeft = this.slideLeft.bind(this);
		this.slideRight = this.slideRight.bind(this);
	}

	componentDidMount() {
		const { autoPlay, useWindowKeyDown } = this.props;
		if (useWindowKeyDown) {
			window.addEventListener("keydown", this.handleKeyDown);
		} else {
			this.imageGallery.current.addEventListener(
				"keydown",
				this.handleKeyDown
			);
		}
		window.addEventListener("mousedown", this.handleMouseDown);
		window.addEventListener("touchmove", this.handleTouchMove, {
			passive: false,
		});

		this.addScreenChangeEvent();
	}

	componentDidUpdate(prevProps, prevState) {
		const {
			items,
			lazyLoad,
			slideDuration,
			slideInterval,
			startIndex,
			thumbnailPosition,
			showThumbnails,
			useWindowKeyDown,
		} = this.props;
		const { currentIndex, isPlaying } = this.state;
		const itemsSizeChanged = prevProps.items.length !== items.length;
		const itemsChanged = !isEqual(prevProps.items, items);
		const startIndexUpdated = prevProps.startIndex !== startIndex;
		const thumbnailsPositionChanged =
			prevProps.thumbnailPosition !== thumbnailPosition;
		const showThumbnailsChanged =
			prevProps.showThumbnails !== showThumbnails;

		if (prevState.currentIndex !== currentIndex) {
			this.slideThumbnailBar();
		}

		if (lazyLoad && (!prevProps.lazyLoad || itemsChanged)) {
			this.lazyLoaded = [];
		}

		if (startIndexUpdated || itemsChanged) {
			// TODO: this should be fix/removed
			this.setState({ currentIndex: startIndex });
		}
	}

	onSliding() {
		const { currentIndex, isTransitioning } = this.state;
		const { onSlide, slideDuration } = this.props;
		this.transitionTimer = window.setTimeout(() => {
			if (isTransitioning) {
				this.setState({
					isTransitioning: !isTransitioning,
					// reset swiping thumbnail after transitioning to new slide,
					// so we can resume thumbnail auto translate
					isSwipingThumbnail: false,
				});
				if (onSlide) {
					onSlide(currentIndex);
				}
			}
		}, slideDuration + 50);
	}

	onThumbnailClick(event, index) {
		const { onThumbnailClick } = this.props;
		// blur element to remove outline cause by focus
		event.target.parentNode.parentNode.blur();
		this.slideToIndex(index, event);
		if (onThumbnailClick) {
			onThumbnailClick(event, index);
		}
	}

	onThumbnailMouseOver(event, index) {
		if (this.thumbnailMouseOverTimer) {
			window.clearTimeout(this.thumbnailMouseOverTimer);
			this.thumbnailMouseOverTimer = null;
		}
		this.thumbnailMouseOverTimer = window.setTimeout(() => {
			this.slideToIndex(index);
			// this.pause();
		}, 300);
	}

	onThumbnailMouseLeave() {
		if (this.thumbnailMouseOverTimer) {
			window.clearTimeout(this.thumbnailMouseOverTimer);
			this.thumbnailMouseOverTimer = null;
		}
	}

	setThumbsTranslate(thumbsTranslate) {
		this.setState({ thumbsTranslate });
	}

	setModalFullscreen(state) {
		const { onScreenChange } = this.props;
		this.setState({ modalFullscreen: state });
		// manually call because browser does not support screenchange events
		if (onScreenChange) {
			onScreenChange(state);
		}
	}

	getThumbsTranslate(indexDifference) {
		const { disableThumbnailScroll, items } = this.props;
		const { thumbnailsWrapperWidth, thumbnailsWrapperHeight } = this.state;
		let totalScroll;
		const thumbsElement = this.thumbnails && this.thumbnails.current;

		if (disableThumbnailScroll) return 0;

		if (thumbsElement) {
			// total scroll required to see the last thumbnail
			if (this.isThumbnailVertical()) {
				if (thumbsElement.scrollHeight <= thumbnailsWrapperHeight) {
					return 0;
				}
				totalScroll =
					thumbsElement.scrollHeight - thumbnailsWrapperHeight;
			} else {
				if (
					thumbsElement.scrollWidth <= thumbnailsWrapperWidth ||
					thumbnailsWrapperWidth <= 0
				) {
					return 0;
				}
				totalScroll =
					thumbsElement.scrollWidth - thumbnailsWrapperWidth;
			}
			// scroll-x required per index change
			const perIndexScroll = totalScroll / (items.length - 1);
			return indexDifference * perIndexScroll;
		}
		return 0;
	}

	getAlignmentClassName(index) {
		// Necessary for lazing loading
		const { currentIndex } = this.state;
		const { infinite, items } = this.props;
		let alignment = "";
		const leftClassName = "left";
		const centerClassName = "center";
		const rightClassName = "right";

		switch (index) {
			case currentIndex - 1:
				alignment = ` ${leftClassName}`;
				break;
			case currentIndex:
				alignment = ` ${centerClassName}`;
				break;
			case currentIndex + 1:
				alignment = ` ${rightClassName}`;
				break;
			default:
				break;
		}

		return alignment;
	}

	getThumbnailBarHeight() {
		if (this.isThumbnailVertical()) {
			const { gallerySlideWrapperHeight } = this.state;
			return { height: gallerySlideWrapperHeight };
		}
		return {};
	}

	getSlideStyle(index) {
		const { currentIndex, currentSlideOffset, slideStyle } = this.state;
		const { infinite, items, useTranslate3D, isRTL } = this.props;
		const baseTranslateX = -100 * currentIndex;
		const totalSlides = items.length - 1;

		// calculates where the other slides belong based on currentIndex
		// if it is RTL the base line should be reversed
		let translateX =
			(baseTranslateX + index * 100) * (isRTL ? -1 : 1) +
			currentSlideOffset;

		if (infinite && items.length > 2) {
			if (currentIndex === 0 && index === totalSlides) {
				// make the last slide the slide before the first
				// if it is RTL the base line should be reversed
				translateX = -100 * (isRTL ? -1 : 1) + currentSlideOffset;
			} else if (currentIndex === totalSlides && index === 0) {
				// make the first slide the slide after the last
				// if it is RTL the base line should be reversed
				translateX = 100 * (isRTL ? -1 : 1) + currentSlideOffset;
			}
		}

		let translate = `translate(${translateX}%, 0)`;

		if (useTranslate3D) {
			translate = `translate3d(${translateX}%, 0, 0)`;
		}

		// don't show some slides while transitioning to avoid background transitions
		const isVisible = this.isSlideVisible(index);

		return {
			display: isVisible ? "inherit" : "none",
			WebkitTransform: translate,
			MozTransform: translate,
			msTransform: translate,
			OTransform: translate,
			transform: translate,
			...slideStyle,
		};
	}

	getCurrentIndex() {
		const { currentIndex } = this.state;
		return currentIndex;
	}

	getThumbnailStyle() {
		let translate;
		const { useTranslate3D, isRTL } = this.props;
		const { thumbsTranslate, thumbsStyle } = this.state;
		const verticalTranslateValue = isRTL
			? thumbsTranslate * -1
			: thumbsTranslate;

		return {
			WebkitTransform: translate,
			MozTransform: translate,
			msTransform: translate,
			OTransform: translate,
			transform: translate,
			...thumbsStyle,
		};
	}

	getSlideItems() {
		const { currentIndex } = this.state;
		const {
			items,
			slideOnThumbnailOver,
			onClick,
			lazyLoad,
			onTouchMove,
			onTouchEnd,
			onTouchStart,
			onMouseOver,
			onMouseLeave,
			renderItem,
			renderThumbInner,
			showThumbnails,
			showBullets,
		} = this.props;

		const slides = [];
		const thumbnails = [];
		const bullets = [];

		items.forEach((item, index) => {
			const alignment = this.getAlignmentClassName(index);
			const originalClass = item.originalClass
				? ` ${item.originalClass}`
				: "";
			const thumbnailClass = item.thumbnailClass
				? ` ${item.thumbnailClass}`
				: "";
			const handleRenderItem =
				item.renderItem || renderItem || this.renderItem;
			const handleRenderThumbInner =
				item.renderThumbInner ||
				renderThumbInner ||
				this.renderThumbInner;

			const showItem = !lazyLoad || alignment || this.lazyLoaded[index];
			if (showItem && lazyLoad && !this.lazyLoaded[index]) {
				this.lazyLoaded[index] = true;
			}

			const slideStyle = this.getSlideStyle(index);

			const slide = (
				<div
					aria-label={`Go to Slide ${index + 1}`}
					key={`slide-${index}`}
					tabIndex="-1"
					className={`image-gallery-slide ${alignment} ${originalClass}`}
					style={slideStyle}
					onClick={onClick}
					onTouchMove={onTouchMove}
					onTouchEnd={onTouchEnd}
					onTouchStart={onTouchStart}
					onMouseOver={onMouseOver}
					onFocus={onMouseOver}
					onMouseLeave={onMouseLeave}
					role="button"
				>
					{showItem ? (
						handleRenderItem(item)
					) : (
						<div style={{ height: "100%" }} />
					)}
				</div>
			);

			slides.push(slide);

			// Don't add thumbnails if there is none
			if (showThumbnails && item.thumbnail) {
				const igThumbnailClass = clsx(
					"image-gallery-thumbnail",
					thumbnailClass,
					{ active: currentIndex === index }
				);
				thumbnails.push(
					<button
						key={`thumbnail-${index}`}
						type="button"
						tabIndex="0"
						aria-pressed={currentIndex === index ? "true" : "false"}
						aria-label={`Go to Slide ${index + 1}`}
						className={igThumbnailClass}
						onMouseLeave={
							slideOnThumbnailOver
								? this.onThumbnailMouseLeave
								: null
						}
						onMouseOver={(event) =>
							this.handleThumbnailMouseOver(event, index)
						}
						onFocus={(event) =>
							this.handleThumbnailMouseOver(event, index)
						}
						onClick={(event) => this.onThumbnailClick(event, index)}
					>
						{handleRenderThumbInner(item)}
					</button>
				);
			}

			if (showBullets) {
				// generate bullet elements and store them in array
				const bulletOnClick = (event) => {
					if (item.bulletOnClick) {
						item.bulletOnClick({
							item,
							itemIndex: index,
							currentIndex,
						});
					}
					// blur element to remove outline caused by focus
					event.target.blur();
					return this.slideToIndex.call(this, index, event);
				};
				const igBulletClass = clsx(
					"image-gallery-bullet",
					item.bulletClass,
					{ active: currentIndex === index }
				);
				bullets.push(
					<button
						type="button"
						key={`bullet-${index}`}
						className={igBulletClass}
						onClick={bulletOnClick}
						aria-pressed={currentIndex === index ? "true" : "false"}
						aria-label={`Go to Slide ${index + 1}`}
					/>
				);
			}
		});

		return {
			slides,
			thumbnails,
			bullets,
		};
	}

	ignoreIsTransitioning() {
		/*
      Ignore isTransitioning because were not going to sibling slides
      e.g. center to left or center to right
    */
		const { items } = this.props;
		const { previousIndex, currentIndex } = this.state;
		const totalSlides = items.length - 1;

		// we want to show the in between slides transition
		const slidingMoreThanOneSlideLeftOrRight =
			Math.abs(previousIndex - currentIndex) > 1;
		const notGoingFromFirstToLast = !(
			previousIndex === 0 && currentIndex === totalSlides
		);
		const notGoingFromLastToFirst = !(
			previousIndex === totalSlides && currentIndex === 0
		);

		return (
			slidingMoreThanOneSlideLeftOrRight &&
			notGoingFromFirstToLast &&
			notGoingFromLastToFirst
		);
	}

	isFirstOrLastSlide(index) {
		const { items } = this.props;
		const totalSlides = items.length - 1;
		const isLastSlide = index === totalSlides;
		const isFirstSlide = index === 0;
		return isLastSlide || isFirstSlide;
	}

	slideIsTransitioning(index) {
		/*
    returns true if the gallery is transitioning and the index is not the
    previous or currentIndex
    */
		const { isTransitioning, previousIndex, currentIndex } = this.state;
		const indexIsNotPreviousOrNextSlide = !(
			index === previousIndex || index === currentIndex
		);
		return isTransitioning && indexIsNotPreviousOrNextSlide;
	}

	isSlideVisible(index) {
		/*
      Show slide if slide is the current slide and the next slide
      OR
      The slide is going more than one slide left or right, but not going from
      first to last and not going from last to first

      Edge case:
      If you go to the first or last slide, when they're
      not left, or right of each other they will try to catch up in the background
      so unless were going from first to last or vice versa we don't want the first
      or last slide to show up during the transition
    */
		return (
			!this.slideIsTransitioning(index) ||
			(this.ignoreIsTransitioning() && !this.isFirstOrLastSlide(index))
		);
	}

	slideThumbnailBar() {
		const { currentIndex, isSwipingThumbnail } = this.state;
		const nextTranslate = -this.getThumbsTranslate(currentIndex);
		if (isSwipingThumbnail) {
			return;
		}

		if (currentIndex === 0) {
			this.setState({ thumbsTranslate: 0, thumbsSwipedTranslate: 0 });
		} else {
			this.setState({
				thumbsTranslate: nextTranslate,
				thumbsSwipedTranslate: nextTranslate,
			});
		}
	}

	canSlide() {
		const { items } = this.props;
		return items.length >= 2;
	}

	canSlideLeft() {
		const { infinite, isRTL } = this.props;
		return (
			infinite || (isRTL ? this.canSlideNext() : this.canSlidePrevious())
		);
	}

	canSlideRight() {
		const { infinite, isRTL } = this.props;
		return (
			infinite || (isRTL ? this.canSlidePrevious() : this.canSlideNext())
		);
	}

	canSlidePrevious() {
		const { currentIndex } = this.state;
		return currentIndex > 0;
	}

	canSlideNext() {
		const { currentIndex } = this.state;
		const { items } = this.props;
		return currentIndex < items.length - 1;
	}

	handleSwiping({ event, absX, dir }) {
		const { disableSwipe, stopPropagation } = this.props;
		const {
			galleryWidth,
			isTransitioning,
			swipingUpDown,
			swipingLeftRight,
		} = this.state;

		// if the initial swiping is up/down prevent moving the slides until swipe ends
		
			if (!swipingUpDown) {
				this.setState({ swipingUpDown: true });
			}
			return;
		

		// if ((dir === LEFT || dir === RIGHT) && !swipingLeftRight) {
		// 	this.setState({ swipingLeftRight: true });
		// }

		// if (disableSwipe) return;

		// // const { swipingTransitionDuration } = this.props;
		// if (stopPropagation) {
		// 	event.preventDefault();
		// }

		// if (!isTransitioning) {
		// 	const side = dir === RIGHT ? 1 : -1;

		// 	let currentSlideOffset = (absX / galleryWidth) * 100;
		// 	if (Math.abs(currentSlideOffset) >= 100) {
		// 		currentSlideOffset = 100;
		// 	}

		// 	const swipingTransition = {
		// 		transition: `transform ${swipingTransitionDuration}ms ease-out`,
		// 	};

		// 	this.setState({
		// 		currentSlideOffset: side * currentSlideOffset,
		// 		slideStyle: swipingTransition,
		// 	});
		// } else {
		// 	// don't move the slide
		// 	this.setState({ currentSlideOffset: 0 });
		// }
	}

	handleThumbnailSwiping({ event, absX, absY, dir }) {
		const { stopPropagation, swipingThumbnailTransitionDuration } =
			this.props;
		const {
			thumbsSwipedTranslate,
			thumbnailsWrapperHeight,
			thumbnailsWrapperWidth,
			swipingUpDown,
			swipingLeftRight,
		} = this.state;

		if (this.isThumbnailVertical()) {
			// if the initial swiping is left/right, prevent moving the thumbnail bar until swipe ends
			if (
				(dir === LEFT || dir === RIGHT || swipingLeftRight) &&
				!swipingUpDown
			) {
				if (!swipingLeftRight) {
					this.setState({ swipingLeftRight: true });
				}
				return;
			}

		} else {
			if ((dir === LEFT || dir === RIGHT) && !swipingLeftRight) {
				this.setState({ swipingLeftRight: true });
			}
		}

		const thumbsElement = this.thumbnails && this.thumbnails.current;
		const emptySpaceMargin = 20; // 20px to add some margin to show empty space

		let thumbsTranslate;
		let totalSwipeableLength;
		let hasSwipedPassedEnd;
		let hasSwipedPassedStart;
		let isThumbnailBarSmallerThanContainer;

		if (this.isThumbnailVertical()) {
		} else {
			const slideX = dir === RIGHT ? absX : -absX;
			thumbsTranslate = thumbsSwipedTranslate + slideX;
			totalSwipeableLength =
				thumbsElement.scrollWidth -
				thumbnailsWrapperWidth +
				emptySpaceMargin;
			hasSwipedPassedEnd =
				Math.abs(thumbsTranslate) > totalSwipeableLength;
			hasSwipedPassedStart = thumbsTranslate > emptySpaceMargin;
			isThumbnailBarSmallerThanContainer =
				thumbsElement.scrollWidth <= thumbnailsWrapperWidth;
		}

		if (isThumbnailBarSmallerThanContainer) {
			// no need to swipe a thumbnail bar smaller/shorter than its container
			return;
		}

		if ((dir === LEFT) && hasSwipedPassedEnd) {
			// prevent further swipeing
			return;
		}

		if ((dir === RIGHT) && hasSwipedPassedStart) {
			// prevent further swipeing
			return;
		}

		if (stopPropagation) event.stopPropagation();

		const swipingTransition = {
			transition: `transform ${swipingThumbnailTransitionDuration}ms ease-out`,
		};

		this.setState({
			thumbsTranslate,
			thumbsStyle: swipingTransition,
		});
	}

	handleOnThumbnailSwiped() {
		const { thumbsTranslate } = this.state;
		const { slideDuration } = this.props;
		this.resetSwipingDirection();
		this.setState({
			isSwipingThumbnail: true,
			thumbsSwipedTranslate: thumbsTranslate,
			thumbsStyle: { transition: `all ${slideDuration}ms ease-out` },
		});
	}

	sufficientSwipe() {
		const { currentSlideOffset } = this.state;
		const { swipeThreshold } = this.props;
		return Math.abs(currentSlideOffset) > swipeThreshold;
	}

	resetSwipingDirection() {
		const { swipingUpDown, swipingLeftRight } = this.state;
		if (swipingUpDown) {
			// user stopped swipingUpDown, reset
			this.setState({ swipingUpDown: false });
		}

		if (swipingLeftRight) {
			// user stopped swipingLeftRight, reset
			this.setState({ swipingLeftRight: false });
		}
	}

	handleOnSwiped({ event, dir, velocity }) {
		const { disableSwipe, stopPropagation, flickThreshold } = this.props;

		if (disableSwipe) return;

		const { isRTL } = this.props;
		if (stopPropagation) event.stopPropagation();
		this.resetSwipingDirection();

		// if it is RTL the direction is reversed
		const swipeDirection = (dir === LEFT ? 1 : -1) * (isRTL ? -1 : 1);
		
		const isLeftRightFlick = velocity > flickThreshold;
		this.handleOnSwipedTo(swipeDirection, isLeftRightFlick);
	}

	handleOnSwipedTo(swipeDirection, isLeftRightFlick) {
		const { currentIndex, isTransitioning } = this.state;
		let slideTo = currentIndex;

		if ((this.sufficientSwipe() || isLeftRightFlick) && !isTransitioning) {
			// slideto the next/prev slide
			slideTo += swipeDirection;
		}

		// If we can't swipe left or right, stay in the current index (noop)
		if (
			(swipeDirection === -1 && !this.canSlideLeft()) ||
			(swipeDirection === 1 && !this.canSlideRight())
		) {
			slideTo = currentIndex;
		}

		// this.unthrottledSlideToIndex(slideTo);
	}

	handleTouchMove(event) {
		const { swipingLeftRight } = this.state;
		if (swipingLeftRight) {
			// prevent background scrolling up and down while swiping left and right
			event.preventDefault();
		}
	}

	handleMouseDown() {
		// keep track of mouse vs keyboard usage for a11y
		this.imageGallery.current.classList.add("image-gallery-using-mouse");
	}

	handleKeyDown(event) {
		const { disableKeyDown, useBrowserFullscreen } = this.props;
		const { isFullscreen } = this.state;
		// keep track of mouse vs keyboard usage for a11y
		this.imageGallery.current.classList.remove("image-gallery-using-mouse");

		if (disableKeyDown) return;
		const LEFT_ARROW = 37;
		const RIGHT_ARROW = 39;
		const key = parseInt(event.keyCode || event.which || 0, 10);

		switch (key) {
			case LEFT_ARROW:
				if (this.canSlideLeft()) {
					this.slideLeft(event);
				}
				break;
			case RIGHT_ARROW:
				if (this.canSlideRight()) {
					this.slideRight(event);
				}
				break;
			default:
				break;
		}
	}

	handleImageError(event) {
		const { onErrorImageURL } = this.props;
		if (
			onErrorImageURL &&
			event.target.src.indexOf(onErrorImageURL) === -1
		) {
			/* eslint-disable no-param-reassign */
			event.target.src = onErrorImageURL;
			/* eslint-enable no-param-reassign */
		}
	}

	handleResize() {
		const { currentIndex } = this.state;

		// if there is no resizeObserver, component has been unmounted
		if (!this.resizeObserver) {
			return;
		}

		if (this.imageGallery && this.imageGallery.current) {
			this.setState({
				galleryWidth: this.imageGallery.current.offsetWidth,
			});
		}

		if (
			this.imageGallerySlideWrapper &&
			this.imageGallerySlideWrapper.current
		) {
			this.setState({
				gallerySlideWrapperHeight:
					this.imageGallerySlideWrapper.current.offsetHeight,
			});
		}

		if (this.thumbnailsWrapper && this.thumbnailsWrapper.current) {
			if (this.isThumbnailVertical()) {
				this.setState({
					thumbnailsWrapperHeight:
						this.thumbnailsWrapper.current.offsetHeight,
				});
			} else {
				this.setState({
					thumbnailsWrapperWidth:
						this.thumbnailsWrapper.current.offsetWidth,
				});
			}
		}

		// Adjust thumbnail container when thumbnail width or height is adjusted
		this.setThumbsTranslate(-this.getThumbsTranslate(currentIndex));
	}

	handleScreenChange() {
		/*
      handles screen change events that the browser triggers e.g. esc key
    */
		const { onScreenChange, useBrowserFullscreen } = this.props;
		const fullScreenElement =
			document.fullscreenElement ||
			document.msFullscreenElement ||
			document.mozFullScreenElement ||
			document.webkitFullscreenElement;

		// check if screenchange element is the gallery
		const isFullscreen = this.imageGallery.current === fullScreenElement;
		if (onScreenChange) onScreenChange(isFullscreen);
		if (useBrowserFullscreen) this.setState({ isFullscreen });
	}

	slideToIndex(index, event) {
		const { currentIndex, isTransitioning } = this.state;
		const { items, slideDuration, onBeforeSlide } = this.props;

		if (!isTransitioning) {
			if (event) {
			}

			const slideCount = items.length - 1;
			let nextIndex = index;
			if (index < 0) {
				nextIndex = slideCount;
			} else if (index > slideCount) {
				nextIndex = 0;
			}

			if (onBeforeSlide && nextIndex !== currentIndex) {
				onBeforeSlide(nextIndex);
			}

			this.setState(
				{
					previousIndex: currentIndex,
					currentIndex: nextIndex,
					isTransitioning: nextIndex !== currentIndex,
					currentSlideOffset: 0,
					slideStyle: {
						transition: `all ${slideDuration}ms ease-out`,
					},
				},
				this.onSliding
			);
		}
	}

	slideLeft(event) {
		const { isRTL } = this.props;
		this.slideTo(event, isRTL ? "right" : "left");
	}

	slideRight(event) {
		const { isRTL } = this.props;
		this.slideTo(event, isRTL ? "left" : "right");
	}

	slideTo(event, direction) {
		const { currentIndex, currentSlideOffset, isTransitioning } =
			this.state;
		const { items } = this.props;
		const nextIndex = currentIndex + (direction === "left" ? -1 : 1);

		if (isTransitioning) return;

		this.slideToIndex(nextIndex, event);
	}

	handleThumbnailMouseOver(event, index) {
		const { slideOnThumbnailOver } = this.props;
		if (slideOnThumbnailOver) this.onThumbnailMouseOver(event, index);
	}

	handleThumbnailKeyUp(event, index) {
		// a11y support ^_^
		// if (isEnterOrSpaceKey(event)) this.onThumbnailClick(event, index);
	}

	handleSlideKeyUp(event) {
		// a11y support ^_^
		// if (isEnterOrSpaceKey(event)) {
		// 	const { onClick } = this.props;
		// 	onClick(event);
		// }
	}

	isThumbnailVertical() {
		const { thumbnailPosition } = this.props;
		return thumbnailPosition === "left" || thumbnailPosition === "right";
	}

	addScreenChangeEvent() {
		screenChangeEvents.forEach((eventName) => {
			document.addEventListener(eventName, this.handleScreenChange);
		});
	}

	removeScreenChangeEvent() {
		screenChangeEvents.forEach((eventName) => {
			document.removeEventListener(eventName, this.handleScreenChange);
		});
	}

	fullScreen() {
		const { useBrowserFullscreen } = this.props;
		const gallery = this.imageGallery.current;
		if (useBrowserFullscreen) {
			if (gallery.requestFullscreen) {
				gallery.requestFullscreen();
			} else if (gallery.msRequestFullscreen) {
				gallery.msRequestFullscreen();
			} else if (gallery.mozRequestFullScreen) {
				gallery.mozRequestFullScreen();
			} else if (gallery.webkitRequestFullscreen) {
				gallery.webkitRequestFullscreen();
			} else {
				// fallback to fullscreen modal for unsupported browsers
				this.setModalFullscreen(true);
			}
		} else {
			this.setModalFullscreen(true);
		}
		this.setState({ isFullscreen: true });
	}

	renderItem(item) {
		const { isFullscreen } = this.state;

		return (
			<Item
				fullscreen={item.fullscreen}
				isFullscreen={isFullscreen}
				original={item.original}
			/>
		);
	}

	renderThumbInner(item) {
		return (
			<span className="image-gallery-thumbnail-inner">
				<img
					className="image-gallery-thumbnail-image"
					src={item.thumbnail}
					height={item.thumbnailHeight}
					width={item.thumbnailWidth}
					alt={item.thumbnailAlt}
					title={item.thumbnailTitle}
					loading={item.thumbnailLoading}
					// onError={handleThumbnailError}
				/>
			</span>
		);
	}

	render() {
		const { currentIndex, isFullscreen, modalFullscreen, isPlaying } =
			this.state;

		const {
			additionalClass,
			disableThumbnailSwipe,
			
			isRTL,
			items,
			thumbnailPosition,
			renderCustomControls,
			renderLeftNav,
			renderRightNav,
			showBullets,

			showIndex,
			showThumbnails,
			showNav,
		} = this.props;

		const thumbnailStyle = this.getThumbnailStyle();
		const { slides, thumbnails, bullets } = this.getSlideItems();
		const slideWrapperClass = clsx(
			"image-gallery-slide-wrapper",
			thumbnailPosition,
			{ "image-gallery-rtl": isRTL }
		);

		const slideWrapper = (
			<div
				ref={this.imageGallerySlideWrapper}
				className={slideWrapperClass}
			>
				{renderCustomControls && renderCustomControls()}
				{this.canSlide() ? (
					<React.Fragment>
						<SwipeWrapper
							className="image-gallery-swipe"
							delta={0}
							onSwiping={this.handleSwiping}
							onSwiped={this.handleOnSwiped}
						>
							<div className="image-gallery-slides">{slides}</div>
						</SwipeWrapper>
					</React.Fragment>
				) : (
					<div className="image-gallery-slides">{slides}</div>
				)}
				{showBullets && (
					<div className="image-gallery-bullets">
						<div
							className="image-gallery-bullets-container"
							role="navigation"
							aria-label="Bullet Navigation"
						>
							{bullets}
						</div>
					</div>
				)}

			</div>
		);

		const igClass = clsx("image-gallery", additionalClass, {
			"fullscreen-modal": modalFullscreen,
		});
		const igContentClass = clsx("image-gallery-content", "bottom", {
			fullscreen: isFullscreen,
		});
		const thumbnailWrapperClass = clsx(
			"image-gallery-thumbnails-wrapper",
			"thumbnails-swipe-horizontal"
		);

		return (
			<div ref={this.imageGallery} className={igClass} aria-live="polite">
				<div className={igContentClass}>
					{slideWrapper}
					{showThumbnails && thumbnails.length > 0 ? (
						<React.Fragment>
							<SwipeWrapper
								className={thumbnailWrapperClass}
								delta={0}
								onSwiping={
									!disableThumbnailSwipe &&
									this.handleThumbnailSwiping
								}
								onSwiped={
									!disableThumbnailSwipe &&
									this.handleOnThumbnailSwiped
								}
							>
								{renderLeftNav(
									this.slideLeft,
									!this.canSlideLeft()
								)}
								<div
									className="image-gallery-thumbnails"
									ref={this.thumbnailsWrapper}
									style={this.getThumbnailBarHeight()}
								>
									<nav
										ref={this.thumbnails}
										className="image-gallery-thumbnails-container"
										style={thumbnailStyle}
										aria-label="Thumbnail Navigation"
									>
										{thumbnails}
									</nav>
								</div>
								{renderRightNav(
									this.slideRight,
									!this.canSlideRight()
								)}
							</SwipeWrapper>
						</React.Fragment>
					) : null}
				</div>
			</div>
		);
	}
}

ImageGallery.propTypes = {
	flickThreshold: number,
	items: arrayOf(
		shape({
			bulletClass: string,
			bulletOnClick: func,
			description: string,
			original: string,
			originalHeight: number,
			originalWidth: number,
			loading: string,
			thumbnailHeight: number,
			thumbnailWidth: number,
			thumbnailLoading: string,
			fullscreen: string,
			originalAlt: string,
			originalTitle: string,
			thumbnail: string,
			thumbnailAlt: string,
			thumbnailLabel: string,
			thumbnailTitle: string,
			originalClass: string,
			thumbnailClass: string,
			renderItem: func,
			renderThumbInner: func,
			imageSet: imageSetType,
			srcSet: string,
			sizes: string,
		})
	).isRequired,
	showNav: bool,
	autoPlay: bool,
	lazyLoad: bool,
	infinite: bool,
	showIndex: bool,
	showBullets: bool,
	showThumbnails: bool,
	showPlayButton: bool,
	showFullscreenButton: bool,
	disableThumbnailScroll: bool,
	disableKeyDown: bool,
	disableSwipe: bool,
	disableThumbnailSwipe: bool,
	useBrowserFullscreen: bool,
	onErrorImageURL: string,
	
	thumbnailPosition: oneOf(["top", "bottom", "left", "right"]),
	startIndex: number,
	slideDuration: number,
	slideInterval: number,
	slideOnThumbnailOver: bool,
	swipeThreshold: number,
	swipingTransitionDuration: number,
	swipingThumbnailTransitionDuration: number,
	onSlide: func,
	onBeforeSlide: func,
	onScreenChange: func,
	
	onClick: func,
	onImageLoad: func,
	// onImageError: func,
	onTouchMove: func,
	onTouchEnd: func,
	onTouchStart: func,
	onMouseOver: func,
	onMouseLeave: func,
	// onThumbnailError: func,
	onThumbnailClick: func,
	renderCustomControls: func,
	renderLeftNav: func,
	renderRightNav: func,
	renderPlayPauseButton: func,
	renderFullscreenButton: func,
	renderItem: func,
	renderThumbInner: func,
	stopPropagation: bool,
	additionalClass: string,
	useTranslate3D: bool,
	isRTL: bool,
	useWindowKeyDown: bool,
};

ImageGallery.defaultProps = {
	onErrorImageURL: "",
	additionalClass: "",
	showNav: true,
	lazyLoad: false,
	infinite: false,
	showBullets: false,
	showThumbnails: true,
	showPlayButton: true,
	showFullscreenButton: true,
	disableThumbnailScroll: false,
	disableKeyDown: false,
	disableSwipe: false,
	disableThumbnailSwipe: false,
	useTranslate3D: true,
	isRTL: false,
	useBrowserFullscreen: true,
	flickThreshold: 0.4,
	stopPropagation: false,
	thumbnailPosition: "bottom",
	startIndex: 0,
	swipingTransitionDuration: 0,
	swipingThumbnailTransitionDuration: 0,
	onSlide: null,
	onBeforeSlide: null,
	onScreenChange: null,
	
	onClick: null,
	onImageLoad: null,
	// onImageError: null,
	onTouchMove: null,
	onTouchEnd: null,
	onTouchStart: null,
	onMouseOver: null,
	onMouseLeave: null,
	// onThumbnailError: null,
	onThumbnailClick: null,
	renderCustomControls: null,
	renderThumbInner: null,
	renderItem: null,
	slideInterval: 3000,
	slideOnThumbnailOver: false,
	swipeThreshold: 30,
	renderLeftNav: (onClick, disabled) => (
		<LeftNav onClick={onClick} disabled={disabled} />
	),
	renderRightNav: (onClick, disabled) => (
		<RightNav onClick={onClick} disabled={disabled} />
	),
	useWindowKeyDown: true,
};

export default ImageGallery;
