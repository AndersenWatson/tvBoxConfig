/**
 * 自用tvbox生成配置
 * 数据流:https://github.com/liu673cn/box
 * 直播流:https://github.com/fanmingming/live
 */
const https = require('https')
const fs = require('fs')
const json5 = require('./utils/json5.js')
// 开源仓库配置
const getOpenSourceConfig = {
  wallpaper: 'https://bing.img.run/rand.php',
  image: {
    github: 'https://kkgithub.com',
    githubRaw: 'https://raw.kkgithub.com',
  }, // 镜像
  data: {
    githubUrl: 'https://github.com/liu673cn/box',
    infoUrl: 'https://cdn.jsdelivr.net/gh/liu673cn/box@main/m.json', // https://raw.githubusercontent.com/liu673cn/box/main/m.json
  },
  live: {
    githubUrl: 'https://github.com/fanmingming/live',
    infoUrl: 'https://fanmingming.com/txt?url=https://live.fanmingming.com/tv/m3u/global.m3u',
    epgUrl: 'https://live.fanmingming.com/e.xml?ch={name}&date={date}', // 预告EPG
    logoUrl: 'https://live.fanmingming.com/tv/{name}.png',
  },
}
// 设置新配置
const currentDate = new Date()
const setNewConfig = {
  time: currentDate.getFullYear() +
    '-' +
    (currentDate.getMonth() + 1).toString().padStart(2, '0') +
    '-' +
    currentDate.getDate().toString().padStart(2, '0') +
    ' ' +
    currentDate.getHours() +
    ':' +
    currentDate.getMinutes() +
    ':' +
    currentDate.getSeconds(),
}
// 获取开源数据
const handleInitData = () => {
  const req = https.get(getOpenSourceConfig.data.infoUrl, (res) => {
    res.setEncoding('utf8')
    let responseData = ''
    res.on('data', (data) => {
      responseData += data
    })
    res.on('end', (e) => {
      console.log('获取数据源成功')
      // 使用json5处理不规范的json
      try {
        responseData = json5.parse(responseData)
      } catch (error) {
        console.log('数据源转换失败', error)
      }
      // 设置壁纸
      responseData.wallpaper = getOpenSourceConfig?.wallpaper ?? ''
      // 设置直播
      responseData.lives = [{
        name: '直播',
        type: 0,
        url: './lives.txt',
        epg: getOpenSourceConfig?.live?.epgUrl ?? '',
        logo: getOpenSourceConfig?.live?.logoUrl ?? '',
      }, ]
      req.end()
      handleSpiderFile(responseData)
        .then((res) => {
          return handleWriteFile('data.json', JSON.stringify(res))
        })
        .then(() => {
          handleInitLive() // 获取直播流
        })
    })
  })
  req.on('error', (e) => {
    console.log('获取数据源失败')
  })
}
// 获取开源数据
const handleInitLive = () => {
  const req = https.get(getOpenSourceConfig.live.infoUrl, (res) => {
    res.setEncoding('utf8')
    let responseData = ''
    res.on('data', (data) => {
      responseData += data
    })

    res.on('end', (e) => {
      console.log('获取直播源成功')
      req.end()
      // 现在有提供:M3U To TXT,
      handleWriteFile('lives.txt', responseData).then(() => {
        console.log('====================')
        console.log('当前时间:' + setNewConfig.time)
        console.log('处理状态:处理完成')
        console.log('====================')
      })
    })
  })
  req.on('error', (e) => {
    console.error('获取直播源失败')
    // 若是以后直播源成功但是转txt失败则可以进行以下尝试
    // 先调用直播源后使用handleLivesData(responseData)处理
  })
}

// / 处理spider文件
const handleSpiderFile = (responseData) => {
  return new Promise((resolve, reject) => {
    // spider
    if (responseData?.spider) {
      const spiderStr = responseData?.spider ?? ''
      const spiderUrl = spiderStr
        .split(';')
        ?.find((item) => item.indexOf('.jar') !== -1)
      if (spiderUrl) {
        const filePath = './spider.jar'
        // 设置spider
        responseData.spider = spiderStr.replaceAll(spiderUrl, filePath)
        // 需要检测是网址还是相对路径或是绝对路径
        let spiderDownloadUrl = ''
        if (spiderUrl.indexOf('http') === 0) {
          spiderDownloadUrl = spiderUrl
            ?.replaceAll(
              'https://github.com',
              getOpenSourceConfig.image.githubRaw
            )
            ?.replaceAll(
              'https://raw.github.com',
              getOpenSourceConfig.image.githubRaw
            )
            ?.replaceAll(
              'https://raw.githubusercontent.com',
              getOpenSourceConfig.image.githubRaw
            )
        } else if (
          spiderUrl.indexOf('./') === 0 ||
          spiderUrl.indexOf('../') === 0 ||
          spiderUrl.indexOf('/') === 0
        ) {
          // github获取具体文件会增加文件树和分支此处默认添加
          spiderDownloadUrl = new URL(
              spiderUrl,
              getOpenSourceConfig.data.githubUrl + '/main/'
            )?.href
            ?.replaceAll(
              'https://github.com',
              getOpenSourceConfig.image.githubRaw
            )
            ?.replaceAll(
              'https://raw.github.com',
              getOpenSourceConfig.image.githubRaw
            )
            ?.replaceAll(
              'https://raw.githubusercontent.com',
              getOpenSourceConfig.image.githubRaw
            )
        } else {
          console.log('spider规则未匹配,请查看:' + spiderStr)
          resolve(responseData)
        }
        const req = https.get(spiderDownloadUrl, (res) => {
          console.log('获取spider成功')
          const stream = fs.createWriteStream(filePath)
          res.pipe(stream)
          stream.on('finish', () => {
            console.log('文件创建成功:spider.jar')
            resolve(responseData)
          })
          res.on('end', (e) => {
            req.end()
          })
        })
        req.on('error', (e) => {
          console.log('获取spider失败,请重试或手动下载:' + spiderDownloadUrl)
          reject()
        })
      } else {
        console.log('未找到jar,请查看:' + spiderStr)
        resolve(responseData)
      }
    } else {
      resolve(responseData)
    }
  })
}

// 处理直播源数据
const handleLivesData = (responseData) => {
  // 处理数据
  const livesTextArr = responseData?.split('#EXTINF:-1 ')?.map((item) => {
    // 再次分割
    let itemStr = ''
    item
      ?.replaceAll("'", '')
      ?.replaceAll('"', '')
      ?.replaceAll('\n', ' ')
      ?.split(' ')
      ?.filter((itemArrInfo) => itemArrInfo !== '')
      ?.map((itemArrInfo) => {
        if (itemArrInfo.indexOf('group-title=') !== -1) {
          itemStr +=
            itemArrInfo?.replaceAll('group-title=', '')?.replaceAll(',', '') +
            ','
        } else if (itemArrInfo.indexOf('https://') === 0) {
          itemStr += itemArrInfo?.replaceAll('group-title=', '') + '\n'
        }
      })
    return itemStr
  })
  return livesTextArr.join('')
}

// 处理写入文件
const handleWriteFile = (name, data) => {
  return new Promise((resolve, reject) => {
    const filePath = './' + name
    const content = data
    fs.writeFile(filePath, content, (err) => {
      if (err) {
        console.log('文件创建失败:' + name)
        console.log('文件错误信息:' + err)
        reject(err)
      } else {
        console.log('文件创建完毕:' + name)
        resolve()
      }
    })
  })
}

// 开始处理
handleInitData()