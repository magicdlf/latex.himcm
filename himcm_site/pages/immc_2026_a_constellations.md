# IMMC 2026 秋季赛 A 新星座

### First Glance
题目给了你一个星座坐标的数据集，让我们重新画一下星座，然后建议我们用LLM给这些星座取名，赋上新的意义。
首先会有一个数学部分，在球坐标系里投影上这些星的坐标，考虑不同纬度，应该有一些数学上的推理。然后是一个聚类，要把天空中的一些区域用聚类的方式划分出来，形成“星座”。然后再根据坐标，形状进行微调，生成有意义的星座名字。

### 上手

先试一下最简单的一步，把星座的数据plot出来看一下。

![image-20251206095414965](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206095414965.png)

AI表现得太过好了，他已经考虑到了不同星等的亮度问题了，用灰度和像素数做了类似曝光的渲染，作为对比，让我们来看看如果只是每个坐标上点一个点会如何:

![image-20251206095520309](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206095520309.png)

可以想象最终如果我们写成文章的话，大概会用以下的形式来做展示

![image-20251206095614511](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206095614511.png)

### 聚类

图里的点实在太多了，虽然可以聚类，但是点太多也不方便形成星座。粗暴地筛选所有的3等星以上（一般视力情况下能看清的星等）先画出来看看效果。同时，选定了聚类算法后我们可以试着用最小生成树的方式来找星座：把距离最近的点先连起来。

![image-20251206095743038](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206095743038.png)

实际上每晚上你不可能看到整个的球体，所以我们简单把天空分成4份:

![image-20251206100312570](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100312570.png)

### 加强版（课上没做）

以上工作显然没考虑在球体里的投影，也没有考虑纬度（接近地平线 vs 接近天顶），没有考虑银河（由一大堆低视等的星星形成的暗带），所以可以先对这些部分做微调。

颜色：大部分星是白色的，有些星是红色的，会被赋予不同的意义。

随机生成树：在星座已经确定的情况下，不要用最小距离来生成，产生不同的星座连线方式，并加以解释

AI取名：建议是先画线再让AI想象，并且画上插画

### 其他AI效果展示

![image-20251206100149896](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100149896.png)

![image-20251206100155113](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100155113.png)

![image-20251206100427526](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100427526.png)

### 一些星座

![image-20251206100452379](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100452379.png)

![image-20251206100455718](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100455718.png)

![image-20251206100500896](/Users/magicdlf/Library/Application Support/typora-user-images/image-20251206100500896.png)