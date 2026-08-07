import '@/global.css';
import { initPanel } from '@/panel';
import { initPublicApi } from '@/publicApi';
import { initPlaceholderImages } from '@/util/placeholderImages';

$(() => {
  initPublicApi();
  initPanel();
  initPlaceholderImages();
});
